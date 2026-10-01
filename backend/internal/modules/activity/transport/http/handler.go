// Package http exposes activity feeds.
package http

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/cards/{cardId}/activity", httpx.H(h.card))
}

func (h *Handler) card(w http.ResponseWriter, r *http.Request) error {
	card, err := uuid.Parse(chi.URLParam(r, "cardId"))
	if err != nil {
		return apperr.New(carddomain.ErrNotFound, "card not found")
	}
	q := r.URL.Query()
	var before *int64
	if b, err := strconv.ParseInt(q.Get("before"), 10, 64); err == nil {
		before = &b
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	p, _ := authtoken.FromContext(r.Context())
	vs, more, err := h.svc.CardFeed(r.Context(), p.UserID, card, before, limit)
	if err != nil {
		return err
	}
	out := api.ActivityPage{Items: make([]api.ActivityEntry, len(vs))}
	for i, v := range vs {
		e := api.ActivityEntry{Id: v.ID, Kind: v.Kind, Data: v.Data, At: v.At}
		if e.Data == nil {
			e.Data = map[string]any{}
		}
		if v.Actor != nil {
			e.Actor = &api.PersonRef{Id: v.Actor.ID, Name: v.Actor.Name, AvatarUrl: v.Actor.AvatarURL}
		}
		out.Items[i] = e
	}
	if more {
		last := vs[len(vs)-1].ID
		out.NextBefore = &last
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}
