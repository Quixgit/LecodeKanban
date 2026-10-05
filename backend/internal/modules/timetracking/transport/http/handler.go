// Package http exposes time tracking: a card's log, timers and manual entries.
package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
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
	r.Patch("/time-entries/{entryId}", httpx.H(h.update))
	r.Put("/cards/{cardId}/time-estimate", httpx.H(h.estimate))
	r.Get("/workspaces/{workspaceId}/time", httpx.H(h.timesheet))
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
	out := api.TimeSummary{Entries: make([]api.TimeEntry, len(sum.Entries)), TotalSeconds: sum.TotalSeconds, EstimateSeconds: sum.EstimateSeconds}
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

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "entryId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.TimeEntryPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, service.UpdateInput{Seconds: in.Seconds, Note: in.Note, StartedAt: in.StartedAt})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(v))
	return nil
}

func (h *Handler) estimate(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.TimeEstimateInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	seconds, err := h.svc.SetEstimate(r.Context(), userID(r), card, in.Seconds)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.TimeEstimate{Seconds: seconds})
	return nil
}

func (h *Handler) timesheet(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	q := service.SheetQuery{}
	var perr error
	if q.From, perr = time.Parse(time.RFC3339, r.URL.Query().Get("from")); perr != nil {
		return validationError("from")
	}
	if q.To, perr = time.Parse(time.RFC3339, r.URL.Query().Get("to")); perr != nil {
		return validationError("to")
	}
	if s := r.URL.Query().Get("userId"); s != "" {
		id, err := uuid.Parse(s)
		if err != nil {
			return validationError("userId")
		}
		q.UserID = &id
	}
	if s := r.URL.Query().Get("projectId"); s != "" {
		id, err := uuid.Parse(s)
		if err != nil {
			return validationError("projectId")
		}
		q.ProjectID = &id
	}
	sheet, err := h.svc.Timesheet(r.Context(), userID(r), ws, q)
	if err != nil {
		return err
	}
	out := api.Timesheet{Entries: make([]api.TimesheetEntry, len(sheet.Entries)), TotalSeconds: sheet.TotalSeconds}
	for i, e := range sheet.Entries {
		p := e.Project
		out.Entries[i] = api.TimesheetEntry{Entry: toAPI(e.View), Card: api.TimesheetCard{Id: e.CardID,
			Key: p.Key + "-" + strconv.Itoa(e.CardNumber), Title: e.CardTitle,
			Project: api.ProjectRef{Id: p.ID, Key: p.Key, Name: p.Name, Icon: api.ProjectIcon(p.Icon), Tone: api.Tone(p.Tone)}}}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func validationError(field string) error {
	var v validation.V
	v.Add(field, validation.Required, nil)
	return v.Err()
}
