// Package http exposes projects over REST.
package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/optional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

// LocaleOf returns the caller's UI language (users module) for localized defaults.
type LocaleOf func(r *http.Request) string

type Handler struct {
	svc    *service.Service
	locale LocaleOf
}

func NewHandler(svc *service.Service, locale LocaleOf) *Handler {
	return &Handler{svc: svc, locale: locale}
}

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/projects", httpx.H(h.list))
	r.Post("/workspaces/{workspaceId}/projects", httpx.H(h.create))
	r.Get("/workspaces/{workspaceId}/projects/summary", httpx.H(h.summary))
	r.Get("/projects/{projectId}", httpx.H(h.get))
	r.Patch("/projects/{projectId}", httpx.H(h.update))
	r.Delete("/projects/{projectId}", httpx.H(h.archive))
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

func date(t *time.Time) *openapi_types.Date {
	if t == nil {
		return nil
	}
	return &openapi_types.Date{Time: *t}
}

func fromDate(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}
	t := d.Time
	return &t
}

// ToAPI renders a project view.
func ToAPI(v service.View) api.Project {
	out := api.Project{
		Id: v.ID, Key: v.Key, Name: v.Name, Description: v.Description, Status: api.ProjectStatus(v.Status),
		Overdue: v.Overdue, Team: v.Team, Icon: api.ProjectIcon(v.Icon), Tone: api.Tone(v.Tone),
		StartDate: date(v.StartDate), Deadline: date(v.Deadline), TaskCount: v.TaskCount, DoneCount: v.DoneCount,
		Progress: v.Progress(), CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt,
	}
	if v.PIC != nil {
		out.Pic = &api.PersonRef{Id: v.PIC.ID, Name: v.PIC.Name, AvatarUrl: v.PIC.AvatarURL}
	}
	if v.PICRole != nil {
		role := api.Role(*v.PICRole)
		out.PicRole = &role
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	q := r.URL.Query()
	f := domain.Filter{Query: q.Get("q"), Progress: q.Get("progress"), Deadline: q.Get("deadline"), Sort: q.Get("sort"), Desc: q.Get("order") == "desc"}
	if s := domain.Status(q.Get("status")); s.Valid() {
		f.Status = &s
	}
	if id, err := uuid.Parse(q.Get("picId")); err == nil {
		f.PICID = &id
	}
	if t := q.Get("team"); t != "" {
		f.Team = &t
	}
	pg := pagination.FromQuery(q)
	views, total, err := h.svc.List(r.Context(), userID(r), ws, f, pg)
	if err != nil {
		return err
	}
	items := make([]api.Project, len(views))
	for i, v := range views {
		items[i] = ToAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, api.ProjectPage{Items: items, Total: total, Page: pg.Page, PageSize: pg.Size})
	return nil
}

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	s, err := h.svc.Summary(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.ProjectSummary{
		Total: s.Total, Completed: s.Completed, InProgress: s.InProgress, Pending: s.Pending, Overdue: s.Overdue, Teams: s.Teams,
	})
	return nil
}

func deref[T ~string](p *T) string {
	if p == nil {
		return ""
	}
	return string(*p)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ProjectInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	ci := service.CreateInput{
		Name: in.Name, Status: domain.Status(deref(in.Status)), Icon: deref(in.Icon), Tone: deref(in.Tone),
		Team: in.Team, StartDate: fromDate(in.StartDate), Deadline: fromDate(in.Deadline), PICID: in.PicId,
	}
	if in.Key != nil {
		ci.Key = *in.Key
	}
	if in.Description != nil {
		ci.Description = *in.Description
	}
	v, err := h.svc.Create(r.Context(), userID(r), ws, ci, h.locale(r))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, ToAPI(v))
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "projectId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	v, err := h.svc.Get(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, ToAPI(v))
	return nil
}

// patchBody mirrors api.ProjectPatch but records presence/null per field.
type patchBody struct {
	Name        optional.Field[string]             `json:"name"`
	Description optional.Field[string]             `json:"description"`
	Status      optional.Field[string]             `json:"status"`
	PicID       optional.Field[uuid.UUID]          `json:"picId"`
	Team        optional.Field[string]             `json:"team"`
	Icon        optional.Field[string]             `json:"icon"`
	Tone        optional.Field[string]             `json:"tone"`
	StartDate   optional.Field[openapi_types.Date] `json:"startDate"`
	Deadline    optional.Field[openapi_types.Date] `json:"deadline"`
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "projectId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var b patchBody
	if err := httpx.DecodeJSON(w, r, &b); err != nil {
		return err
	}
	p := domain.Patch{
		Name: b.Name.Ptr(), Description: b.Description.Ptr(), Icon: b.Icon.Ptr(), Tone: b.Tone.Ptr(),
		SetPIC: b.PicID.Set, PICID: b.PicID.Ptr(), SetTeam: b.Team.Set, Team: b.Team.Ptr(),
		SetStart: b.StartDate.Set, StartDate: fromDate(b.StartDate.Ptr()),
		SetDeadline: b.Deadline.Set, Deadline: fromDate(b.Deadline.Ptr()),
	}
	if s := b.Status.Ptr(); s != nil {
		st := domain.Status(*s)
		p.Status = &st
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, ToAPI(v))
	return nil
}

func (h *Handler) archive(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "projectId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Archive(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
