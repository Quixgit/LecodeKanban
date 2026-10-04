package http

import (
	"net/http"
	"strconv"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

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

// trend compares two periods. With nothing to compare against there is no percentage (null),
// instead of a misleading +0.00%.
func trend(cur, prev int) api.Trend {
	t := api.Trend{Value: cur, Previous: prev}
	if prev > 0 {
		pct := float32(float64(cur-prev) * 100 / float64(prev))
		t.ChangePct = &pct
	}
	return t
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
