// Package http exposes cards over REST.
package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/optional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/cards", httpx.H(h.list))
	r.Post("/workspaces/{workspaceId}/cards", httpx.H(h.create))
	r.Get("/workspaces/{workspaceId}/cards/summary", httpx.H(h.summary))
	r.Post("/workspaces/{workspaceId}/cards/bulk", httpx.H(h.bulk))
	r.Get("/workspaces/{workspaceId}/cards/stats", httpx.H(h.stats))
	r.Get("/cards/{cardId}", httpx.H(h.get))
	r.Patch("/cards/{cardId}", httpx.H(h.update))
	r.Delete("/cards/{cardId}", httpx.H(h.delete))
	r.Post("/cards/{cardId}/move", httpx.H(h.move))
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

func fromDate(d *openapi_types.Date) *time.Time {
	if d == nil {
		return nil
	}
	t := d.Time
	return &t
}

func person(id uuid.UUID, name string, avatar *string) api.PersonRef {
	return api.PersonRef{Id: id, Name: name, AvatarUrl: avatar}
}

// ToAPI renders a card view.
func ToAPI(v service.View) api.Card {
	out := api.Card{
		Id: v.ID, Key: v.Key, Number: v.Number, Title: v.Title, Description: v.Description,
		Status: api.TaskStatus(v.Status), ColumnId: v.ColumnID, Priority: api.Priority(v.Priority), Progress: v.Progress,
		Project: api.ProjectRef{Id: v.Project.ID, Key: v.Project.Key, Name: v.Project.Name,
			Icon: api.ProjectIcon(v.Project.Icon), Tone: api.Tone(v.Project.Tone)},
		Assignees: make([]api.PersonRef, len(v.Assignees)), Position: v.Position, Version: v.Version,
		CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt, CompletedAt: v.CompletedAt,
	}
	if v.DueDate != nil {
		out.DueDate = &openapi_types.Date{Time: *v.DueDate}
	}
	for i, u := range v.Assignees {
		out.Assignees[i] = person(u.ID, u.Name, u.AvatarURL)
	}
	return out
}

func filterFrom(r *http.Request) domain.Filter {
	q := r.URL.Query()
	f := domain.Filter{Query: q.Get("q"), Due: q.Get("due"), Sort: q.Get("sort"), Desc: q.Get("order") == "desc"}
	if s := domain.Status(q.Get("status")); s.Valid() {
		f.Status = &s
	}
	if p := domain.Priority(q.Get("priority")); p.Valid() {
		f.Priority = &p
	}
	if id, err := uuid.Parse(q.Get("projectId")); err == nil {
		f.ProjectID = &id
	}
	if id, err := uuid.Parse(q.Get("assigneeId")); err == nil {
		f.AssigneeID = &id
	}
	return f
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	pg := pagination.FromQuery(r.URL.Query())
	views, total, err := h.svc.List(r.Context(), userID(r), ws, filterFrom(r), pg)
	if err != nil {
		return err
	}
	items := make([]api.Card, len(views))
	for i, v := range views {
		items[i] = ToAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, api.CardPage{Items: items, Total: total, Page: pg.Page, PageSize: pg.Size})
	return nil
}

func counts(c domain.Counts) api.StatusCounts {
	return api.StatusCounts{Todo: c[domain.Todo], InProgress: c[domain.InProgress], InReview: c[domain.InReview], Done: c[domain.Done]}
}

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	c, err := h.svc.Counts(r.Context(), userID(r), ws, filterFrom(r))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, counts(c))
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CardInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	nc := domain.NewCard{ProjectID: in.ProjectId, ColumnID: in.ColumnId, Title: in.Title, DueDate: fromDate(in.DueDate)}
	if in.Description != nil {
		nc.Description = *in.Description
	}
	if in.Status != nil {
		nc.Status = domain.Status(*in.Status)
	}
	if in.Priority != nil {
		nc.Priority = domain.Priority(*in.Priority)
	}
	if in.Progress != nil {
		nc.Progress = *in.Progress
	}
	if in.AssigneeIds != nil {
		nc.AssigneeIDs = *in.AssigneeIds
	}
	v, err := h.svc.Create(r.Context(), userID(r), ws, nc)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, ToAPI(v))
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
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

type patchBody struct {
	Version     int                                `json:"version"`
	Title       optional.Field[string]             `json:"title"`
	Description optional.Field[string]             `json:"description"`
	Priority    optional.Field[string]             `json:"priority"`
	Progress    optional.Field[int]                `json:"progress"`
	DueDate     optional.Field[openapi_types.Date] `json:"dueDate"`
	AssigneeIDs optional.Field[[]uuid.UUID]        `json:"assigneeIds"`
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var b patchBody
	if err := httpx.DecodeJSON(w, r, &b); err != nil {
		return err
	}
	p := domain.Patch{Version: b.Version, Title: b.Title.Ptr(), Description: b.Description.Ptr(), Progress: b.Progress.Ptr(),
		SetDue: b.DueDate.Set, DueDate: fromDate(b.DueDate.Ptr())}
	if s := b.Priority.Ptr(); s != nil {
		pr := domain.Priority(*s)
		p.Priority = &pr
	}
	if ids := b.AssigneeIDs.Ptr(); ids != nil {
		p.AssigneeIDs = ids
	} else if b.AssigneeIDs.Set {
		empty := []uuid.UUID{}
		p.AssigneeIDs = &empty
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, ToAPI(v))
	return nil
}

func (h *Handler) move(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CardMove
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	m := domain.Move{Version: in.Version, ColumnID: in.ColumnId, AfterID: in.AfterId, BeforeID: in.BeforeId}
	if in.Status != nil {
		s := domain.Status(*in.Status)
		m.Status = &s
	}
	v, err := h.svc.Move(r.Context(), userID(r), id, m)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, ToAPI(v))
	return nil
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) bulk(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.BulkCardAction
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	a := service.BulkAction{IDs: in.Ids, Action: string(in.Action)}
	if in.Status != nil {
		s := domain.Status(*in.Status)
		a.Status = &s
	}
	if in.Priority != nil {
		p := domain.Priority(*in.Priority)
		a.Priority = &p
	}
	n, err := h.svc.Bulk(r.Context(), userID(r), ws, a)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.BulkResult{Updated: n})
	return nil
}

func trend(cur, prev int) api.Trend {
	pct := 0.0
	if prev > 0 {
		pct = float64(cur-prev) * 100 / float64(prev)
	}
	return api.Trend{Value: cur, Previous: prev, ChangePct: float32(pct)}
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	st, err := h.svc.Stats(r.Context(), userID(r), ws, days)
	if err != nil {
		return err
	}
	out := api.DashboardStats{
		Active: st.KPIs.Active, Total: st.KPIs.Total, InReview: st.KPIs.InReview, Overdue: st.KPIs.Overdue,
		CompletedThisWeek: trend(st.KPIs.DoneThisWeek, st.KPIs.DonePrevWeek),
		CreatedThisWeek:   trend(st.KPIs.CreatedThisWeek, st.KPIs.CreatedPrevWeek),
		StatusCounts:      counts(st.Counts),
		Daily:             make([]api.DailyActivity, len(st.Daily)),
		Activity:          make([]api.ActivityItem, len(st.Activity)),
	}
	for i, d := range st.Daily {
		out.Daily[i] = api.DailyActivity{Date: openapi_types.Date{Time: d.Date}, Todo: d.Counts[domain.Todo],
			InProgress: d.Counts[domain.InProgress], InReview: d.Counts[domain.InReview], Done: d.Counts[domain.Done]}
	}
	for i, t := range st.Activity {
		ref := st.Projects[t.ProjectID]
		item := api.ActivityItem{Id: t.ID, To: api.TaskStatus(t.To), At: t.At,
			Project: api.ProjectRef{Id: ref.ID, Key: ref.Key, Name: ref.Name, Icon: api.ProjectIcon(ref.Icon), Tone: api.Tone(ref.Tone)}}
		item.Card.Id, item.Card.Key, item.Card.Title = t.CardID, ref.Key+"-"+strconv.Itoa(t.Number), t.Title
		if t.From != nil {
			f := api.TaskStatus(*t.From)
			item.From = &f
		}
		if t.ActorID != nil {
			if u, ok := st.Actors[*t.ActorID]; ok {
				p := person(u.ID, u.Name, u.AvatarURL)
				item.Actor = &p
			}
		}
		out.Activity[i] = item
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}
