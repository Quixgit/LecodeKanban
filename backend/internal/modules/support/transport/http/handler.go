// Package http exposes support requests over REST.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/support", httpx.H(h.list))
	r.Post("/workspaces/{workspaceId}/support", httpx.H(h.create))
	r.Patch("/support/{requestId}", httpx.H(h.update))
	r.Get("/support/{requestId}/screenshot", httpx.H(h.screenshot))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func param(r *http.Request, name string, code apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(code, "not found")
	}
	return id, nil
}

func toAPI(v service.View) api.SupportRequest {
	out := api.SupportRequest{Id: v.ID, Kind: api.SupportKind(v.Kind), Subject: v.Subject, Message: v.Message, PageUrl: v.PageURL,
		UserAgent: v.UserAgent, HasScreenshot: v.HasScreenshot, Status: api.SupportStatus(v.Status), CreatedAt: v.CreatedAt,
		UpdatedAt: v.UpdatedAt, ResolvedAt: v.ResolvedAt}
	if v.Author != nil {
		out.Author = &api.PersonRef{Id: v.Author.ID, Name: v.Author.Name, AvatarUrl: v.Author.AvatarURL}
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var status *domain.Status
	if s := r.URL.Query().Get("status"); s != "" {
		st := domain.Status(s)
		status = &st
	}
	list, err := h.svc.List(r.Context(), userID(r), ws, status, r.URL.Query().Get("mine") == "true")
	if err != nil {
		return err
	}
	out := make([]api.SupportRequest, len(list))
	for i, v := range list {
		out[i] = toAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// maxBody leaves room for a 2 MB screenshot as base64 plus the text around it.
const maxBody = 3<<20 + 64<<10

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	var in api.SupportRequestInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	si := service.Input{Kind: domain.Kind(in.Kind), Subject: in.Subject, Message: in.Message}
	if in.PageUrl != nil {
		si.PageURL = *in.PageUrl
	}
	if in.UserAgent != nil {
		si.UserAgent = *in.UserAgent
	}
	if in.Screenshot != nil {
		si.Screenshot, si.ScreenshotType = in.Screenshot.Data, string(in.Screenshot.ContentType)
	}
	v, err := h.svc.Create(r.Context(), userID(r), ws, si)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(v))
	return nil
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "requestId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.SupportRequestPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.SetStatus(r.Context(), userID(r), id, domain.Status(in.Status))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(v))
	return nil
}

func (h *Handler) screenshot(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "requestId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	s, err := h.svc.Screenshot(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	// The type was checked against the bytes when it was stored; the sandbox keeps a browser from running anything.
	w.Header().Set("Content-Type", s.ContentType)
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	_, _ = w.Write(s.Data)
	return nil
}
