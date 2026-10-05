// Package http exposes task templates and recurring tasks over REST.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	cardhttp "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/templates", httpx.H(h.listTemplates))
	r.Post("/workspaces/{workspaceId}/templates", httpx.H(h.createTemplate))
	r.Put("/templates/{templateId}", httpx.H(h.updateTemplate))
	r.Delete("/templates/{templateId}", httpx.H(h.deleteTemplate))
	r.Post("/templates/{templateId}/use", httpx.H(h.use))
	r.Get("/workspaces/{workspaceId}/recurring", httpx.H(h.listRecurring))
	r.Post("/workspaces/{workspaceId}/recurring", httpx.H(h.createRecurring))
	r.Put("/recurring/{recurringId}", httpx.H(h.updateRecurring))
	r.Delete("/recurring/{recurringId}", httpx.H(h.deleteRecurring))
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

func orEmpty[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func toTemplate(t domain.Template) api.TaskTemplate {
	return api.TaskTemplate{Id: t.ID, Name: t.Name, Title: t.Title, Description: t.Description, Priority: api.Priority(t.Priority),
		LabelIds: orEmpty(t.LabelIDs), AssigneeIds: orEmpty(t.AssigneeIDs), Checklist: orEmpty(t.Checklist), Subtasks: orEmpty(t.Subtasks),
		DueInDays: t.DueInDays, CreatedAt: t.CreatedAt}
}

func fromTemplate(in api.TaskTemplateInput) service.TemplateInput {
	out := service.TemplateInput{Name: in.Name, Title: in.Title, DueInDays: in.DueInDays}
	if in.Description != nil {
		out.Description = *in.Description
	}
	if in.Priority != nil {
		out.Priority = string(*in.Priority)
	}
	if in.LabelIds != nil {
		out.LabelIDs = *in.LabelIds
	}
	if in.AssigneeIds != nil {
		out.AssigneeIDs = *in.AssigneeIds
	}
	if in.Checklist != nil {
		out.Checklist = *in.Checklist
	}
	if in.Subtasks != nil {
		out.Subtasks = *in.Subtasks
	}
	return out
}

func (h *Handler) listTemplates(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	list, err := h.svc.Templates(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.TaskTemplate, len(list))
	for i, t := range list {
		out[i] = toTemplate(t)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createTemplate(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.TaskTemplateInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	t, err := h.svc.CreateTemplate(r.Context(), userID(r), ws, fromTemplate(in))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toTemplate(t))
	return nil
}

func (h *Handler) updateTemplate(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "templateId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.TaskTemplateInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	t, err := h.svc.UpdateTemplate(r.Context(), userID(r), id, fromTemplate(in))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toTemplate(t))
	return nil
}

func (h *Handler) deleteTemplate(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "templateId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteTemplate(r.Context(), userID(r), id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) use(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "templateId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.UseTemplateRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	u := service.UseInput{ProjectID: in.ProjectId, ColumnID: in.ColumnId, Title: in.Title}
	if in.DueDate != nil {
		d := in.DueDate.Time
		u.DueDate = &d
	}
	card, err := h.svc.Use(r.Context(), userID(r), id, u)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, cardhttp.ToAPI(card))
	return nil
}

func toRecurring(x domain.Recurrence) api.RecurringTask {
	out := api.RecurringTask{Id: x.ID, TemplateId: x.TemplateID, ProjectId: x.ProjectID, Freq: api.RecurringTaskFreq(x.Freq),
		Weekdays: orEmpty(x.Weekdays), Hour: x.Hour, Timezone: x.Timezone, Active: x.Active, NextRunAt: x.NextRunAt,
		LastRunAt: x.LastRunAt, LastCardId: x.LastCardID, LastError: x.LastError}
	if x.MonthDay > 0 {
		d := x.MonthDay
		out.MonthDay = &d
	}
	return out
}

func fromRecurring(in api.RecurringTaskInput) service.RecurrenceInput {
	out := service.RecurrenceInput{TemplateID: in.TemplateId, ProjectID: in.ProjectId, Freq: domain.Freq(in.Freq), Hour: in.Hour, Active: true}
	if in.Weekdays != nil {
		out.Weekdays = *in.Weekdays
	}
	if in.MonthDay != nil {
		out.MonthDay = *in.MonthDay
	}
	if in.Timezone != nil {
		out.Timezone = *in.Timezone
	}
	if in.Active != nil {
		out.Active = *in.Active
	}
	return out
}

func (h *Handler) listRecurring(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	list, err := h.svc.Recurring(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.RecurringTask, len(list))
	for i, x := range list {
		out[i] = toRecurring(x)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createRecurring(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.RecurringTaskInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	x, err := h.svc.CreateRecurring(r.Context(), userID(r), ws, fromRecurring(in))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toRecurring(x))
	return nil
}

func (h *Handler) updateRecurring(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "recurringId", domain.ErrRecurringMissing)
	if err != nil {
		return err
	}
	var in api.RecurringTaskInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	x, err := h.svc.UpdateRecurring(r.Context(), userID(r), id, fromRecurring(in))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toRecurring(x))
	return nil
}

func (h *Handler) deleteRecurring(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "recurringId", domain.ErrRecurringMissing)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteRecurring(r.Context(), userID(r), id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
