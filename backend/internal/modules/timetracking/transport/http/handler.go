// Package http exposes time tracking: a card's log, timers and manual entries.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/cards/{cardId}/time", httpx.H(h.list))
	r.Post("/cards/{cardId}/time", httpx.H(h.log))
	r.Post("/cards/{cardId}/timer", httpx.H(h.start))
	r.Get("/timer", httpx.H(h.running))
	r.Post("/time-entries/{entryId}/stop", httpx.H(h.stop))
	r.Delete("/time-entries/{entryId}", httpx.H(h.delete))
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

func toAPI(v service.View) api.TimeEntry {
	out := api.TimeEntry{Id: v.ID, CardId: v.CardID, StartedAt: v.StartedAt, EndedAt: v.EndedAt, Seconds: v.Elapsed,
		Running: v.Running(), Note: v.Note, Manual: v.Manual}
	if v.User != nil {
		out.User = &api.PersonRef{Id: v.User.ID, Name: v.User.Name, AvatarUrl: v.User.AvatarURL}
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	sum, err := h.svc.List(r.Context(), userID(r), card)
	if err != nil {
		return err
	}
	out := api.TimeSummary{Entries: make([]api.TimeEntry, len(sum.Entries)), TotalSeconds: sum.TotalSeconds}
	for i, v := range sum.Entries {
		out.Entries[i] = toAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) log(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.TimeLogInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	li := service.LogInput{Seconds: in.Seconds, StartedAt: in.StartedAt}
	if in.Note != nil {
		li.Note = *in.Note
	}
	v, err := h.svc.Log(r.Context(), userID(r), card, li)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(v))
	return nil
}

func (h *Handler) start(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	v, err := h.svc.Start(r.Context(), userID(r), card)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(v))
	return nil
}

func (h *Handler) running(w http.ResponseWriter, r *http.Request) error {
	v, err := h.svc.Running(r.Context(), userID(r))
	if err != nil {
		return err
	}
	out := api.RunningTimer{}
	if v != nil {
		e := toAPI(*v)
		out.Entry = &e
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) stop(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "entryId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	v, err := h.svc.Stop(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(v))
	return nil
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "entryId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
