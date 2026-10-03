package main

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/storage/local"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth"
	authevents "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/i18n"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users"
	usershttp "github.com/reliabilix/lecodekanban/backend/internal/modules/users/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/metrics"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/middleware"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/reactions"
)

// App is the fully wired HTTP application (composition root).
type App struct {
	Router   http.Handler
	Metrics  *metrics.Metrics
	Realtime *realtime.Hub
}

// build wires every module by hand: no globals, no reflection.
func build(cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) (*App, error) {
	bus := eventbus.New()
	tokens := authtoken.NewManager(cfg.SecretKeyBytes(), cfg.AccessTTL)
	m := metrics.New()

	usersMod := users.New(users.Deps{Pool: pool, Bus: bus})

	// users' HTTP layer needs auth (providers, password change) and auth needs users' presenter;
	// the closure breaks the construction cycle without either package importing the other.
	var usersHTTP *usershttp.Handler
	authMod := auth.New(auth.Deps{
		Config: cfg, Pool: pool, Bus: bus, Tokens: tokens, Users: usersMod.Service,
		Present: func(ctx context.Context, id uuid.UUID) (api.User, error) { return usersHTTP.PresentByID(ctx, id) },
	})
	usersHTTP = usersMod.NewHTTP(authMod.Service, authMod.Service)

	wsMod := workspaces.New(workspaces.Deps{Pool: pool, Bus: bus, Users: usersMod.Service, PublicURL: cfg.PublicURL})
	i18nMod := i18n.New()

	boardsMod := boards.New(pool, wsMod.Service, bus)
	projectsMod := projects.New(projects.Deps{
		Pool: pool, Bus: bus, Workspaces: wsMod.Service, Boards: boardsMod.Service, Users: usersMod.Service,
		Locale: func(r *http.Request) string {
			p, _ := authtoken.FromContext(r.Context())
			if u, err := usersMod.Service.Get(r.Context(), p.UserID); err == nil {
				return string(u.Locale)
			}
			return "en"
		},
	})
	cardsMod := cards.New(cards.Deps{
		Pool: pool, Bus: bus, Workspaces: wsMod.Service, Projects: projectsMod.Service,
		Boards: boardsMod.Service, Users: usersMod.Service,
	})
	projectsMod.Service.SetCardCounter(cardsMod.Service)
	boardsMod.Service.SetCardCounter(cardsMod.Service)

	commentsMod := comments.New(comments.Deps{Pool: pool, Bus: bus, Cards: cardsMod.Service,
		Workspaces: wsMod.Service, Users: usersMod.Service})
	storage, err := local.New(cfg.AttachmentsDir)
	if err != nil {
		return nil, err
	}
	attachmentsMod := attachments.New(attachments.Deps{Pool: pool, Bus: bus, Storage: storage,
		MaxBytes: cfg.AttachmentMaxBytes(), Cards: cardsMod.Service, Workspaces: wsMod.Service, Users: usersMod.Service})
	timeMod := timetracking.New(timetracking.Deps{Pool: pool, Cards: cardsMod.Service, Workspaces: wsMod.Service,
		Users: usersMod.Service})
	wikiMod := wiki.New(wiki.Deps{Pool: pool, Workspaces: wsMod.Service, Teams: noTeams{}, Projects: projectsMod.Service,
		Storage: storage, MaxUploadBytes: cfg.AttachmentMaxBytes()})
	activityMod := activity.New(pool, cardsMod.Service, usersMod.Service)
	hub := realtime.NewHub(cfg.DatabaseURL, log)

	// Cross-module reactions.
	eventbus.Subscribe(bus, func(ctx context.Context, e authevents.UserRegistered) error {
		return wsMod.Service.EnsurePersonal(ctx, e.UserID)
	})
	reactions.Register(bus, reactions.Deps{Projects: projectsMod.Service, Cards: cardsMod.Service,
		Activity: activityMod.Service, Realtime: realtime.NewPublisher(pool, log)})

	origins := allowedOrigins(cfg)
	r := chi.NewRouter()
	r.Use(
		middleware.RequestID(log),
		middleware.ClientIP(cfg.TrustProxy),
		middleware.AccessLog,
		middleware.Recoverer,
		middleware.SecurityHeaders(cfg.CookieSecure),
		m.Middleware,
		middleware.Timeout(30*time.Second),
	)
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			httpx.WriteError(w, r, apperr.Wrap(apperr.Unavailable, "database unavailable", err))
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})

	r.Route("/api/v1", func(r chi.Router) {
		if len(cfg.CORSOrigins) > 0 {
			r.Use(cors.Handler(cors.Options{
				AllowedOrigins: cfg.CORSOrigins, AllowCredentials: true, MaxAge: 600,
				AllowedMethods: []string{"GET", "POST", "PATCH", "PUT", "DELETE"},
				AllowedHeaders: []string{"Content-Type", middleware.CSRFHeader, middleware.RequestIDHeader},
			}))
		}
		r.Use(middleware.CSRF(origins), middleware.Authenticate(tokens))

		authMod.HTTP.PublicRoutes(r)
		wsMod.HTTP.PublicRoutes(r)
		i18nMod.PublicRoutes(r)

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth)
			authMod.HTTP.PrivateRoutes(r)
			usersHTTP.Routes(r)
			wsMod.HTTP.PrivateRoutes(r)
			projectsMod.HTTP.PrivateRoutes(r)
			boardsMod.HTTP.PrivateRoutes(r)
			cardsMod.HTTP.PrivateRoutes(r)
			commentsMod.HTTP.PrivateRoutes(r)
			attachmentsMod.HTTP.PrivateRoutes(r)
			timeMod.HTTP.PrivateRoutes(r)
			wikiMod.HTTP.PrivateRoutes(r)
			activityMod.HTTP.PrivateRoutes(r)
			r.Get("/workspaces/{workspaceId}/events", hub.Handler(
				func(r *http.Request) (uuid.UUID, error) {
					id, err := uuid.Parse(chi.URLParam(r, "workspaceId"))
					if err != nil {
						return uuid.Nil, apperr.New(wsdomain.ErrNotFound, "workspace not found")
					}
					return id, nil
				},
				func(r *http.Request, ws uuid.UUID) error {
					p, _ := authtoken.FromContext(r.Context())
					_, err := wsMod.Service.Authorize(r.Context(), ws, p.UserID, wsdomain.PermView)
					return err
				},
				httpx.WriteError,
			))
		})

		r.NotFound(httpx.H(func(http.ResponseWriter, *http.Request) error {
			return apperr.New(apperr.NotFound, "route not found")
		}))
		r.MethodNotAllowed(httpx.H(func(http.ResponseWriter, *http.Request) error {
			return apperr.New(apperr.NotFound, "route not found")
		}))
	})
	return &App{Router: r, Metrics: m, Realtime: hub}, nil
}

// allowedOrigins are the browser origins permitted to send state-changing requests.
func allowedOrigins(cfg *config.Config) []string {
	out := append([]string{}, cfg.CORSOrigins...)
	if u, err := url.Parse(cfg.PublicURL); err == nil {
		out = append(out, u.Scheme+"://"+u.Host)
	}
	return out
}

// noTeams answers wiki team lookups while the product has no teams: nobody belongs to a team and
// team grants are rejected as unknown principals. Replace it when a teams module exists.
type noTeams struct{}

func (noTeams) TeamsOf(context.Context, uuid.UUID, uuid.UUID) ([]uuid.UUID, error) { return nil, nil }
func (noTeams) Exists(context.Context, uuid.UUID, uuid.UUID) (bool, error)         { return false, nil }
