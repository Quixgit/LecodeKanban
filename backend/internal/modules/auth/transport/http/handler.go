// Package http exposes authentication endpoints.
package http

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/oauth"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/middleware"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/ratelimit"
)

// UserPresenter renders a user as the API DTO (provided by the users module).
type UserPresenter func(ctx context.Context, id uuid.UUID) (api.User, error)

type Config struct {
	PublicURL    string
	CookieSecure bool
	SigningKey   []byte
}

type Limiters struct {
	Login    ratelimit.Limiter // per IP
	Register ratelimit.Limiter // per IP
	Email    ratelimit.Limiter // forgot/resend, per IP
}

type Handler struct {
	svc       *service.Service
	present   UserPresenter
	providers oauth.Registry
	cookies   cookieJar
	publicURL string
	lim       Limiters
}

func NewHandler(svc *service.Service, present UserPresenter, providers oauth.Registry, cfg Config, lim Limiters) *Handler {
	return &Handler{
		svc: svc, present: present, providers: providers, publicURL: cfg.PublicURL, lim: lim,
		cookies: cookieJar{secure: cfg.CookieSecure, key: cfg.SigningKey},
	}
}

// PublicRoutes need no session.
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Get("/auth/csrf", httpx.H(h.csrf))
	r.Get("/auth/providers", httpx.H(h.listProviders))
	r.With(middleware.RateLimit("register", h.lim.Register)).Post("/auth/register", httpx.H(h.register))
	r.With(middleware.RateLimit("login", h.lim.Login)).Post("/auth/login", httpx.H(h.login))
	r.Post("/auth/refresh", httpx.H(h.refresh))
	r.Post("/auth/logout", httpx.H(h.logout))
	r.Post("/auth/verify-email", httpx.H(h.verifyEmail))
	r.With(middleware.RateLimit("email", h.lim.Email)).Post("/auth/password/forgot", httpx.H(h.forgot))
	r.With(middleware.RateLimit("reset", h.lim.Login)).Post("/auth/password/reset", httpx.H(h.reset))
	r.Get("/auth/oauth/{provider}/start", httpx.H(h.oauthStart))
	r.Get("/auth/oauth/{provider}/callback", h.oauthCallback)
}

// PrivateRoutes require an authenticated principal.
func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/auth/session", httpx.H(h.session))
	r.With(middleware.RateLimit("email", h.lim.Email)).Post("/auth/verify-email/resend", httpx.H(h.resend))
}

func client(r *http.Request) domain.Client {
	return domain.Client{IP: middleware.IPFrom(r.Context()), UserAgent: r.UserAgent()}
}

func (h *Handler) writeSession(w http.ResponseWriter, r *http.Request, status int, s domain.Session, signIn bool) error {
	if err := h.cookies.setSession(w, s, signIn); err != nil {
		return err
	}
	u, err := h.present(r.Context(), s.UserID)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, status, api.Session{User: u})
	return nil
}

func (h *Handler) csrf(w http.ResponseWriter, _ *http.Request) error {
	tok, err := h.cookies.newCSRF(w)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.CsrfToken{Token: tok})
	return nil
}

func (h *Handler) listProviders(w http.ResponseWriter, _ *http.Request) error {
	httpx.WriteJSON(w, http.StatusOK, api.AuthProviders{
		Google: h.providers.Enabled("google"), Github: h.providers.Enabled("github"),
	})
	return nil
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) error {
	var in api.RegisterRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	locale := ""
	if in.Locale != nil {
		locale = string(*in.Locale)
	}
	s, err := h.svc.Register(r.Context(), service.RegisterInput{Name: in.Name, Email: in.Email, Password: in.Password, Locale: locale}, client(r))
	if err != nil {
		return err
	}
	return h.writeSession(w, r, http.StatusCreated, s, true)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) error {
	var in api.LoginRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	s, err := h.svc.Login(r.Context(), in.Email, in.Password, client(r))
	if err != nil {
		return err
	}
	return h.writeSession(w, r, http.StatusOK, s, true)
}

func refreshValue(r *http.Request) string {
	if c, err := r.Cookie(refreshCookie); err == nil {
		return c.Value
	}
	return ""
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) error {
	s, err := h.svc.Refresh(r.Context(), refreshValue(r), client(r))
	if err != nil {
		if apperr.IsCode(err, domain.ErrSessionExpired) {
			h.cookies.clearSession(w)
		}
		return err
	}
	return h.writeSession(w, r, http.StatusOK, s, false)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) error {
	err := h.svc.Logout(r.Context(), refreshValue(r))
	h.cookies.clearSession(w)
	if err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) session(w http.ResponseWriter, r *http.Request) error {
	p, _ := authtoken.FromContext(r.Context())
	u, err := h.present(r.Context(), p.UserID)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.Session{User: u})
	return nil
}

func (h *Handler) verifyEmail(w http.ResponseWriter, r *http.Request) error {
	var in api.TokenRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.VerifyEmail(r.Context(), in.Token); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) resend(w http.ResponseWriter, r *http.Request) error {
	p, _ := authtoken.FromContext(r.Context())
	if err := h.svc.ResendVerification(r.Context(), p.UserID); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) forgot(w http.ResponseWriter, r *http.Request) error {
	var in api.EmailRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.ForgotPassword(r.Context(), in.Email); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) reset(w http.ResponseWriter, r *http.Request) error {
	var in api.ResetPasswordRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.ResetPassword(r.Context(), in.Token, in.Password); err != nil {
		return err
	}
	h.cookies.clearSession(w)
	httpx.NoContent(w)
	return nil
}

func (h *Handler) redirectURL(provider string) string {
	return h.publicURL + "/api/v1/auth/oauth/" + provider + "/callback"
}

func (h *Handler) oauthStart(w http.ResponseWriter, r *http.Request) error {
	name := chi.URLParam(r, "provider")
	p, ok := h.providers[name]
	if !ok {
		return apperr.New(domain.ErrProviderNotConfigured, "provider not configured")
	}
	state, err := crypto.NewToken(24)
	if err != nil {
		return err
	}
	verifier, err := crypto.NewToken(48)
	if err != nil {
		return err
	}
	locale := r.URL.Query().Get("locale")
	if locale != "uk" {
		locale = "en"
	}
	h.cookies.setOAuth(w, oauthState{Provider: name, State: state, Verifier: verifier, Next: safeNext(r.URL.Query().Get("next")), Locale: locale})
	// The target is the configured provider's authorize endpoint, not user input.
	http.Redirect(w, r, p.AuthCodeURL(state, verifier, h.redirectURL(name)), http.StatusFound) //nolint:gosec // G710
	return nil
}

// oauthCallback always redirects to the SPA: to `next` on success, to /login?error=<code> otherwise.
func (h *Handler) oauthCallback(w http.ResponseWriter, r *http.Request) {
	fail := func(code apperr.Code) {
		h.cookies.clearOAuth(w)
		http.Redirect(w, r, h.publicURL+"/login?error="+url.QueryEscape(string(code)), http.StatusFound)
	}
	name := chi.URLParam(r, "provider")
	p, ok := h.providers[name]
	if !ok {
		fail(domain.ErrProviderNotConfigured)
		return
	}
	st, err := h.cookies.readOAuth(r)
	q := r.URL.Query()
	if err != nil || st.Provider != name || q.Get("state") == "" ||
		subtle.ConstantTimeCompare([]byte(st.State), []byte(q.Get("state"))) != 1 {
		fail(domain.ErrOAuthFailed)
		return
	}
	if q.Get("error") != "" || q.Get("code") == "" {
		fail(domain.ErrOAuthFailed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	profile, err := p.Exchange(ctx, q.Get("code"), st.Verifier, h.redirectURL(name))
	if err != nil {
		logger.From(r.Context()).Warn("oauth exchange failed", slog.String("provider", name), slog.Any("err", err))
		fail(domain.ErrOAuthFailed)
		return
	}
	s, err := h.svc.OAuthLogin(ctx, profile, st.Locale, client(r))
	if err != nil {
		fail(apperr.From(err).Code)
		return
	}
	if err := h.cookies.setSession(w, s, true); err != nil {
		fail(apperr.Internal)
		return
	}
	h.cookies.clearOAuth(w)
	http.Redirect(w, r, h.publicURL+st.Next, http.StatusFound)
}
