// Package http exposes the users module over REST.
package http

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

// ProviderLister reports linked OAuth providers for a user (implemented by the auth module).
type ProviderLister interface {
	ListProviders(ctx context.Context, userID uuid.UUID) ([]string, error)
}

// PasswordChanger changes a password with re-authentication (implemented by the auth module).
type PasswordChanger interface {
	ChangePassword(ctx context.Context, userID, sessionID uuid.UUID, current *string, next string) error
}

type Handler struct {
	svc       *service.Service
	providers ProviderLister
	passwords PasswordChanger
}

func NewHandler(svc *service.Service, providers ProviderLister, passwords PasswordChanger) *Handler {
	return &Handler{svc: svc, providers: providers, passwords: passwords}
}

// Routes mounts authenticated user routes.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/users/me", httpx.H(h.getMe))
	r.Patch("/users/me", httpx.H(h.updateMe))
	r.Post("/users/me/password", httpx.H(h.changePassword))
	r.Post("/users/me/avatar", httpx.H(h.uploadAvatar))
	r.Delete("/users/me/avatar", httpx.H(h.removeAvatar))
	r.Get("/users/{userId}/avatar", httpx.H(h.avatar))
}

// Present converts a user into the API DTO, including linked providers.
func (h *Handler) Present(ctx context.Context, u domain.User) (api.User, error) {
	provs, err := h.providers.ListProviders(ctx, u.ID)
	if err != nil {
		return api.User{}, err
	}
	out := api.User{
		Id: u.ID, Email: u.Email, Name: u.Name, Locale: api.Locale(u.Locale), AvatarUrl: u.AvatarURL,
		EmailVerified: u.EmailVerified(), HasPassword: u.HasPassword, CreatedAt: u.CreatedAt,
		JobTitle: u.JobTitle, Phone: u.Phone, Location: u.Location, Timezone: u.Timezone, Bio: u.Bio,
		Providers: make([]api.UserProviders, 0, len(provs)),
	}
	for _, p := range provs {
		out.Providers = append(out.Providers, api.UserProviders(p))
	}
	return out, nil
}

// PresentByID loads and presents a user (used by the auth module for session responses).
func (h *Handler) PresentByID(ctx context.Context, id uuid.UUID) (api.User, error) {
	u, err := h.svc.Get(ctx, id)
	if err != nil {
		return api.User{}, err
	}
	return h.Present(ctx, u)
}

func principal(r *http.Request) (authtoken.Principal, error) {
	p, ok := authtoken.FromContext(r.Context())
	if !ok {
		return p, apperr.New(apperr.Unauthorized, "authentication required")
	}
	return p, nil
}

func (h *Handler) getMe(w http.ResponseWriter, r *http.Request) error {
	p, err := principal(r)
	if err != nil {
		return err
	}
	out, err := h.PresentByID(r.Context(), p.UserID)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) error {
	p, err := principal(r)
	if err != nil {
		return err
	}
	var in api.UpdateProfileRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	patch := domain.ProfilePatch{Name: in.Name, JobTitle: in.JobTitle, Phone: in.Phone, Location: in.Location,
		Timezone: in.Timezone, Bio: in.Bio}
	if in.Locale != nil {
		l := domain.Locale(*in.Locale)
		patch.Locale = &l
	}
	u, err := h.svc.UpdateProfile(r.Context(), p.UserID, patch)
	if err != nil {
		return err
	}
	out, err := h.Present(r.Context(), u)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) error {
	p, err := principal(r)
	if err != nil {
		return err
	}
	var in api.ChangePasswordRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.passwords.ChangePassword(r.Context(), p.UserID, p.SessionID, in.CurrentPassword, in.NewPassword); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request) error {
	r.Body = http.MaxBytesReader(w, r.Body, service.MaxAvatarBytes+(256<<10))
	if err := r.ParseMultipartForm(service.MaxAvatarBytes); err != nil {
		return apperr.New(domain.ErrAvatarTooLarge, "picture is too large")
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		return apperr.New(domain.ErrBadAvatar, "a file is required")
	}
	defer func() { _ = file.Close() }()
	p, _ := authtoken.FromContext(r.Context())
	u, err := h.svc.SetAvatar(r.Context(), p.UserID, file)
	if err != nil {
		return err
	}
	return h.writeUser(w, r, u)
}

func (h *Handler) removeAvatar(w http.ResponseWriter, r *http.Request) error {
	p, _ := authtoken.FromContext(r.Context())
	u, err := h.svc.RemoveAvatar(r.Context(), p.UserID)
	if err != nil {
		return err
	}
	return h.writeUser(w, r, u)
}

func (h *Handler) writeUser(w http.ResponseWriter, r *http.Request, u domain.User) error {
	out, err := h.Present(r.Context(), u)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// avatar serves a picture to signed-in users. The address carries a version, so it can be cached for good.
func (h *Handler) avatar(w http.ResponseWriter, r *http.Request) error {
	id, err := uuid.Parse(chi.URLParam(r, "userId"))
	if err != nil {
		return apperr.New(domain.ErrNotFound, "no picture")
	}
	f, kind, err := h.svc.OpenAvatar(r.Context(), id)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	w.Header().Set("Content-Type", kind)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	http.ServeContent(w, r, "", time.Time{}, f)
	return nil
}
