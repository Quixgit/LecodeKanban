// Package http exposes the notification inbox.
package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/notifications", httpx.H(h.list))
	r.Post("/workspaces/{workspaceId}/notifications/read", httpx.H(h.read))
	r.Get("/users/me/notification-prefs", httpx.H(h.prefs))
	r.Put("/users/me/notification-prefs", httpx.H(h.setPref))
}

func workspace(r *http.Request) (uuid.UUID, uuid.UUID, error) {
	ws, err := uuid.Parse(chi.URLParam(r, "workspaceId"))
	if err != nil {
		return uuid.Nil, uuid.Nil, apperr.New(wsdomain.ErrNotFound, "workspace not found")
	}
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID, ws, nil
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	user, ws, err := workspace(r)
	if err != nil {
		return err
	}
	q := r.URL.Query()
	var before *time.Time
	if t, err := time.Parse(time.RFC3339Nano, q.Get("before")); err == nil {
		before = &t
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	page, err := h.svc.List(r.Context(), user, ws, before, limit)
	if err != nil {
		return err
	}
	out := api.NotificationPage{Items: make([]api.Notification, len(page.Items)), Unread: page.Unread, Next: page.Next}
	for i, it := range page.Items {
		n := api.Notification{Id: it.ID, Kind: api.NotificationKind(it.Kind), Title: it.Title, Body: it.Body,
			CardId: it.CardID, ProjectId: it.ProjectID, ChannelId: it.ChannelID, MessageId: it.MessageID,
			CreatedAt: it.CreatedAt, Read: it.Read()}
		if it.Link != "" {
			l := it.Link
			n.Link = &l
		}
		if it.Actor != nil {
			n.Actor = &api.PersonRef{Id: it.Actor.ID, Name: it.Actor.Name, AvatarUrl: it.Actor.AvatarURL}
		}
		out.Items[i] = n
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) read(w http.ResponseWriter, r *http.Request) error {
	user, ws, err := workspace(r)
	if err != nil {
		return err
	}
	var in api.NotificationsReadInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	var ids []uuid.UUID
	if in.Ids != nil {
		ids = *in.Ids
	}
	if err := h.svc.MarkRead(r.Context(), user, ws, ids, in.All != nil && *in.All); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) prefs(w http.ResponseWriter, r *http.Request) error {
	p, _ := authtoken.FromContext(r.Context())
	list, err := h.svc.Prefs(r.Context(), p.UserID)
	if err != nil {
		return err
	}
	out := api.NotificationPrefs{Items: make([]api.NotificationPref, len(list))}
	for i, it := range list {
		out.Items[i] = api.NotificationPref{Kind: api.NotificationPrefKind(it.Kind), Enabled: it.Enabled}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) setPref(w http.ResponseWriter, r *http.Request) error {
	var in api.NotificationPrefInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	p, _ := authtoken.FromContext(r.Context())
	if err := h.svc.SetPref(r.Context(), p.UserID, domain.Kind(in.Kind), in.Enabled); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
