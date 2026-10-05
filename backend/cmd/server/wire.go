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
	authsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat"
	chatservice "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github"
	githubclient "github.com/reliabilix/lecodekanban/backend/internal/modules/github/client"
	githubsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/github/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/i18n"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/google"
	integrationsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates"
	templatesvc "github.com/reliabilix/lecodekanban/backend/internal/modules/templates/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users"
	usershttp "github.com/reliabilix/lecodekanban/backend/internal/modules/users/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	wssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
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
	// Integrations runs the calendar loop (sync, meeting reminders).
	Integrations *integrationsvc.Service
	// Templates runs the recurring-task schedules.
	Templates *templatesvc.Service
}

// build wires every module by hand: no globals, no reflection.
func build(cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) (*App, error) {
	bus := eventbus.New()
	tokens := authtoken.NewManager(cfg.SecretKeyBytes(), cfg.AccessTTL)
	m := metrics.New()

	storage, err := local.New(cfg.AttachmentsDir)
	if err != nil {
		return nil, err
	}
	usersMod := users.New(users.Deps{Pool: pool, Bus: bus, Storage: storage})

	// users' HTTP layer needs auth (providers, password change) and auth needs users' presenter;
	// the closure breaks the construction cycle without either package importing the other.
	sealer, err := crypto.NewSealer(cfg.EncryptionKeyBytes())
	if err != nil {
		return nil, err
	}
	var usersHTTP *usershttp.Handler
	authMod := auth.New(auth.Deps{
		Config: cfg, Pool: pool, Bus: bus, Tokens: tokens, Users: usersMod.Service,
		Present: func(ctx context.Context, id uuid.UUID) (api.User, error) { return usersHTTP.PresentByID(ctx, id) },
		Sealer:  sealer,
	})
	usersHTTP = usersMod.NewHTTP(authMod.Service, authMod.Service)

	wsMod := workspaces.New(workspaces.Deps{Pool: pool, Bus: bus, Users: usersMod.Service, PublicURL: cfg.PublicURL,
		Mail: mailInfo(cfg)})
	wsMod.Service.SetTwoFactor(twoFactorGate{authMod.Service})
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
	customFieldsMod := customfields.New(customfields.Deps{Pool: pool, Cards: cardsMod.Service, Workspaces: wsMod.Service})
	supportMod := support.New(support.Deps{Pool: pool, Workspaces: wsMod.Service, Users: usersMod.Service, Log: log,
		Mail: func(ctx context.Context, m mailer.Message, key string) error {
			return mailer.Enqueue(ctx, pool, m, key)
		}})
	templatesMod := templates.New(templates.Deps{Pool: pool, Cards: cardsMod.Service, Workspaces: wsMod.Service,
		Projects: projectsMod.Service, Log: log})
	attachmentsMod := attachments.New(attachments.Deps{Pool: pool, Bus: bus, Storage: storage,
		MaxBytes: cfg.AttachmentMaxBytes(), Cards: cardsMod.Service, Workspaces: wsMod.Service, Users: usersMod.Service})
	timeMod := timetracking.New(timetracking.Deps{Pool: pool, Cards: cardsMod.Service, Workspaces: wsMod.Service,
		Users: usersMod.Service, Projects: projectsMod.Service})
	wikiMod := wiki.New(wiki.Deps{Pool: pool, Workspaces: wsMod.Service, Teams: noTeams{}, Projects: projectsMod.Service,
		Storage: storage, MaxUploadBytes: cfg.AttachmentMaxBytes()})
	chatMod := chat.New(chat.Deps{Pool: pool, Workspaces: wsMod.Service, Users: usersMod.Service,
		Hints: realtime.NewPublisher(pool, log), Bus: bus, Projects: projectsMod.Service, Cards: cardsMod.Service, Storage: storage, MaxUploadBytes: cfg.AttachmentMaxBytes()})
	chat.RegisterFeeds(bus, chatMod.Service)
	notificationsMod := notifications.New(notifications.Deps{Pool: pool, Workspaces: wsMod.Service, Users: usersMod.Service,
		Cards: cardsMod.Service, Projects: projectsMod.Service, Hints: realtime.NewPublisher(pool, log)})
	notifications.Register(bus, notificationsMod.Service, cardsMod.Service)
	integrationsMod := integrations.New(integrations.Deps{Pool: pool, Workspaces: wsMod.Service,
		Calendar: google.New(cfg.GoogleClientID, cfg.GoogleClientSecret, google.Endpoints{Auth: cfg.GoogleAuthURL,
			Token: cfg.GoogleTokenURL, Userinfo: cfg.GoogleUserinfoURL, API: cfg.GoogleAPIURL}),
		Sealer: sealer, Notices: notificationsMod.Service, Channels: chatChannels{chatMod.Service},
		Hints: realtime.NewPublisher(pool, log), PublicURL: cfg.PublicURL, Log: log})
	activityMod := activity.New(pool, cardsMod.Service, usersMod.Service)
	githubMod := github.New(github.Deps{Pool: pool, Workspaces: wsMod.Service, GitHub: githubclient.New(cfg.GitHubAPIURL),
		Cards: githubCards{cardsMod.Service}, Projects: projectsMod.Service, Sealer: sealer,
		Hints: realtime.NewPublisher(pool, log), PublicURL: cfg.PublicURL, Log: log})
	github.Register(bus, githubMod.Service)
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
		r.Use(middleware.CSRF(origins, githubWebhookPath), middleware.Authenticate(tokens))

		authMod.HTTP.PublicRoutes(r)
		wsMod.HTTP.PublicRoutes(r)
		integrationsMod.HTTP.PublicRoutes(r)
		githubMod.HTTP.PublicRoutes(r)
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
			customFieldsMod.HTTP.PrivateRoutes(r)
			supportMod.HTTP.PrivateRoutes(r)
			templatesMod.HTTP.PrivateRoutes(r)
			r.Get("/meta", buildInfo(pool))
			attachmentsMod.HTTP.PrivateRoutes(r)
			timeMod.HTTP.PrivateRoutes(r)
			wikiMod.HTTP.PrivateRoutes(r)
			chatMod.HTTP.PrivateRoutes(r)
			notificationsMod.HTTP.PrivateRoutes(r)
			integrationsMod.HTTP.PrivateRoutes(r)
			githubMod.HTTP.PrivateRoutes(r)
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
	return &App{Router: r, Metrics: m, Realtime: hub, Integrations: integrationsMod.Service, Templates: templatesMod.Service}, nil
}

// githubWebhookPath is signature-verified (HMAC), not cookie-authenticated, so it skips the CSRF check.
const githubWebhookPath = "/api/v1/integrations/github/webhook"

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

// chatChannels lets the integrations module post into chat without knowing chat's types.
type chatChannels struct{ chat *chatservice.Service }

func (c chatChannels) CanPost(ctx context.Context, user, channel uuid.UUID) (uuid.UUID, error) {
	return c.chat.CanPost(ctx, user, channel)
}

func (c chatChannels) PostMeeting(ctx context.Context, ws, channel uuid.UUID, m integrationsvc.MeetingPost) error {
	return c.chat.PostMeeting(ctx, ws, channel, chatservice.MeetingNotice{Title: m.Title, StartsAt: m.StartsAt, EndsAt: m.EndsAt,
		Location: m.Location, Link: m.Link, LeadMinutes: m.LeadMinutes, Attendees: m.Attendees})
}

// githubCards lets the GitHub module work with cards without knowing the cards module's types.
type githubCards struct{ cards *cardssvc.Service }

func githubInfo(v cardssvc.View) githubsvc.CardInfo {
	return githubsvc.CardInfo{ID: v.ID, WorkspaceID: v.WorkspaceID, ProjectID: v.ProjectID, Number: v.Number, Key: v.Key,
		Title: v.Title, Description: v.Description, Status: string(v.Status)}
}

func (g githubCards) FindByKey(ctx context.Context, ws uuid.UUID, key string, number int) (githubsvc.CardInfo, error) {
	ref, err := g.cards.FindByKey(ctx, ws, key, number)
	if err != nil {
		return githubsvc.CardInfo{}, err
	}
	return g.Info(ctx, ref.ID)
}

func (g githubCards) Get(ctx context.Context, user, id uuid.UUID) (githubsvc.CardInfo, error) {
	v, err := g.cards.Get(ctx, user, id)
	return githubInfo(v), err
}

func (g githubCards) Info(ctx context.Context, id uuid.UUID) (githubsvc.CardInfo, error) {
	v, err := g.cards.Snapshot(ctx, id)
	return githubInfo(v), err
}

func (g githubCards) MoveTo(ctx context.Context, actor, id uuid.UUID, status string) error {
	v, err := g.cards.Get(ctx, actor, id)
	if err != nil {
		return err
	}
	st := carddomain.Status(status)
	_, err = g.cards.Move(ctx, actor, id, carddomain.Move{Version: v.Version, Status: &st})
	return err
}

func (g githubCards) Create(ctx context.Context, actor, ws, project uuid.UUID, title, description string) (githubsvc.CardInfo, error) {
	v, err := g.cards.Create(ctx, actor, ws, carddomain.NewCard{ProjectID: project, Title: title, Description: description})
	return githubInfo(v), err
}

// mailInfo says, for the admin centre, how this server sends email (never the credentials).
func mailInfo(cfg *config.Config) wssvc.MailInfo {
	if cfg.Mail.Provider == "mailgun" {
		from := cfg.Mail.MailgunFrom
		if from == "" {
			from = cfg.SMTP.From
		}
		return wssvc.MailInfo{Provider: "mailgun", Host: cfg.Mail.MailgunDomain, From: from}
	}
	return wssvc.MailInfo{Provider: "smtp", Host: cfg.SMTP.Host, From: cfg.SMTP.From}
}

// twoFactorGate lets the workspaces module ask the auth module whether someone has two-step verification on.
type twoFactorGate struct{ auth *authsvc.Service }

func (g twoFactorGate) Enabled(ctx context.Context, user uuid.UUID) (bool, error) {
	st, err := g.auth.TwoFactorStatus(ctx, user)
	return st.Enabled, err
}
