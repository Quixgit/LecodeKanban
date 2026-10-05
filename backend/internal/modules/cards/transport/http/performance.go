package http

import (
	"net/http"
	"strconv"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

func duration(d service.Duration) api.DurationStat {
	return api.DurationStat{Samples: d.Samples, AvgHours: d.AvgHours, MedianHours: d.MedianHours, PreviousAvgHours: d.PreviousAvgHours}
}

// teamPerformance is the Performance page's one query: every number and chart series for the period.
func (h *Handler) teamPerformance(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	f := filterFrom(r)
	rep, err := h.svc.Performance(r.Context(), userID(r), ws, days, service.PerformanceFilter{
		ProjectID: f.ProjectID, AssigneeID: f.AssigneeID, LabelID: f.LabelID})
	if err != nil {
		return err
	}
	out := api.PerformanceReport{
		Days: rep.Days, Throughput: trend(rep.Throughput[0], rep.Throughput[1]),
		CycleTime: duration(rep.Cycle), LeadTime: duration(rep.Lead),
		LateDone: rep.LateDone, DoneWithDue: rep.DoneWithDue, PreviousLateDone: rep.PrevLateDone, PreviousDoneWithDue: rep.PrevDoneWithDue,
		OverdueNow: rep.OverdueNow, WipInProgress: rep.WIPInProgress, WipInReview: rep.WIPInReview, UnassignedOpen: rep.UnassignedOpen,
		Weekly:    make([]api.PerformanceWeek, len(rep.Weekly)),
		Daily:     make([]api.PerformanceDay, len(rep.Daily)),
		Histogram: make([]api.PerformanceBucket, len(rep.Histogram)),
		Aged:      make([]api.PerformanceAged, 0, len(rep.Aged)),
		People:    make([]api.PerformancePerson, len(rep.People)),
		Projects:  make([]api.PerformanceProject, 0, len(rep.Projects)),
	}
	for i, wk := range rep.Weekly {
		out.Weekly[i] = api.PerformanceWeek{Start: openapi_types.Date{Time: wk.Start}, Created: wk.Created, Done: wk.Done}
	}
	for i, d := range rep.Daily {
		out.Daily[i] = api.PerformanceDay{Date: openapi_types.Date{Time: d.Date}, Todo: d.Todo, InProgress: d.InProgress,
			InReview: d.InReview, Done: d.Done, CreatedTotal: d.CreatedTotal, DoneTotal: d.DoneTotal}
	}
	for i, b := range rep.Histogram {
		out.Histogram[i] = api.PerformanceBucket{UpToDays: b.UpToDays, Count: b.Count}
	}
	for i, p := range rep.People {
		out.People[i] = api.PerformancePerson{Person: person(p.User.ID, p.User.Name, p.User.AvatarURL), Open: p.Open, Done: p.Done, Overdue: p.Overdue}
	}
	for _, p := range rep.Projects {
		out.Projects = append(out.Projects, api.PerformanceProject{Project: projectRefOf(p.Ref), Total: p.Total, Done: p.Done,
			Overdue: p.Overdue, DoneInPeriod: p.DoneInPeriod, DonePrevious: p.DonePrev})
	}
	for _, a := range rep.Aged {
		item := api.PerformanceAged{Id: a.ID, Key: rep.Project(a.ProjectID).Key + "-" + strconv.Itoa(a.Number), Title: a.Title,
			Project: projectRefOf(rep.Project(a.ProjectID)), Status: api.TaskStatus(a.Status), AgeHours: a.AgeHours,
			Assignees: []api.PersonRef{}}
		for _, id := range a.Assignees {
			if u, ok := rep.User(id); ok {
				item.Assignees = append(item.Assignees, person(u.ID, u.Name, u.AvatarURL))
			}
		}
		out.Aged = append(out.Aged, item)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func projectRefOf(ref projectsdomain.Ref) api.ProjectRef {
	return api.ProjectRef{Id: ref.ID, Key: ref.Key, Name: ref.Name, Icon: api.ProjectIcon(ref.Icon), Tone: api.Tone(ref.Tone)}
}
