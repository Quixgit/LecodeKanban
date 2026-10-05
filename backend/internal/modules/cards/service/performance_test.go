package service_test

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

var perfNow = time.Date(2026, 10, 14, 12, 0, 0, 0, time.UTC) // a Wednesday

func at(day, hour int) time.Time { return time.Date(2026, 10, day, hour, 0, 0, 0, time.UTC) }

func step(to domain.Status, t time.Time) repository.PerfStep {
	return repository.PerfStep{To: to, At: t}
}

func TestBuildPerformance(t *testing.T) {
	project, ann := uuid.New(), uuid.New()
	due := func(day int) *time.Time { d := time.Date(2026, 10, day, 0, 0, 0, 0, time.UTC); return &d }
	doneAt := func(day, hour int) *time.Time { d := at(day, hour); return &d }
	cards := []repository.PerfCard{
		// Created Oct 8, started Oct 9 10:00, done Oct 11 10:00 (cycle 48h, lead 3d), due Oct 10: late.
		{ID: uuid.New(), ProjectID: project, Status: domain.Done, CreatedAt: at(8, 10), CompletedAt: doneAt(11, 10), DueDate: due(10),
			Assignees: []uuid.UUID{ann}, Steps: []repository.PerfStep{step(domain.Todo, at(8, 10)), step(domain.InProgress, at(9, 10)),
				step(domain.InReview, at(10, 10)), step(domain.Done, at(11, 10))}},
		// Done in 24h, on time.
		{ID: uuid.New(), ProjectID: project, Status: domain.Done, CreatedAt: at(9, 10), CompletedAt: doneAt(12, 10), DueDate: due(13),
			Assignees: []uuid.UUID{ann}, Steps: []repository.PerfStep{step(domain.Todo, at(9, 10)), step(domain.InProgress, at(11, 10)), step(domain.Done, at(12, 10))}},
		// Done in the previous period (7 days: Sep 31..Oct 7 → here Oct 1..7 for days=7... uses Oct 3).
		{ID: uuid.New(), ProjectID: project, Status: domain.Done, CreatedAt: at(1, 10), CompletedAt: doneAt(3, 10),
			Steps: []repository.PerfStep{step(domain.Todo, at(1, 10)), step(domain.InProgress, at(2, 10)), step(domain.Done, at(3, 10))}},
		// Still in review since Oct 10, overdue, with Ann.
		{ID: uuid.New(), ProjectID: project, Status: domain.InReview, CreatedAt: at(9, 9), DueDate: due(12), Title: "Old one",
			Assignees: []uuid.UUID{ann}, Steps: []repository.PerfStep{step(domain.Todo, at(9, 9)), step(domain.InProgress, at(10, 9)), step(domain.InReview, at(12, 9))}},
		// Untouched, no owner.
		{ID: uuid.New(), ProjectID: project, Status: domain.Todo, CreatedAt: at(14, 9), Steps: []repository.PerfStep{step(domain.Todo, at(14, 9))}},
	}
	r := service.BuildPerformance(cards, perfNow, 7)

	if r.Throughput != [2]int{2, 1} {
		t.Fatalf("throughput this/previous: %v", r.Throughput)
	}
	if r.Cycle.AvgHours == nil || *r.Cycle.AvgHours != 36 || *r.Cycle.MedianHours != 36 || *r.Cycle.PreviousAvgHours != 24 {
		t.Fatalf("cycle: %+v avg=%v", r.Cycle, r.Cycle.AvgHours)
	}
	if r.Lead.AvgHours == nil || *r.Lead.AvgHours != 72 { // both took exactly three days from creation to done
		t.Fatalf("lead: %v", r.Lead.AvgHours)
	}
	if r.DoneWithDue != 2 || r.LateDone != 1 {
		t.Fatalf("late share: %d of %d", r.LateDone, r.DoneWithDue)
	}
	if r.OverdueNow != 1 || r.WIPInReview != 1 || r.WIPInProgress != 0 || r.UnassignedOpen != 1 {
		t.Fatalf("now: overdue %d review %d progress %d unassigned %d", r.OverdueNow, r.WIPInReview, r.WIPInProgress, r.UnassignedOpen)
	}

	// Aged: the review task, in work since Oct 10 09:00 → 4 days 3 hours.
	if len(r.Aged) != 1 || r.Aged[0].Title != "Old one" || r.Aged[0].AgeHours != 99 {
		t.Fatalf("aged: %+v", r.Aged)
	}

	// Histogram: cycle 48h falls in [2,3) days, 24h in [1,2).
	counts := make([]int, len(r.Histogram))
	for i, b := range r.Histogram {
		counts[i] = b.Count
	}
	if counts[1] != 1 || counts[2] != 1 || r.Histogram[len(r.Histogram)-1].UpToDays != nil {
		t.Fatalf("histogram: %v", counts)
	}

	// Days: 7 of them ending today; burn-up is cumulative; flow counts every task in exactly one status.
	if len(r.Daily) != 7 || !r.Daily[6].Date.Equal(time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("days: %+v", r.Daily)
	}
	last := r.Daily[6]
	if last.DoneTotal != 2 || last.CreatedTotal != 4 { // created Oct 8, 9, 9, 14 within Oct 8..14
		t.Fatalf("burn-up: %+v", last)
	}
	if last.Todo+last.InProgress+last.InReview+last.Done != 5 || last.Done != 3 || last.InReview != 1 || last.Todo != 1 {
		t.Fatalf("flow: %+v", last)
	}
	if first := r.Daily[0]; first.Todo+first.InProgress+first.InReview+first.Done != 2 { // Oct 8: the Oct 1 task (done) and the one created that day
		t.Fatalf("first day flow: %+v", first)
	}

	// People and projects.
	if len(r.People) != 1 || r.People[0].User.ID != ann || r.People[0].Open != 1 || r.People[0].Done != 2 || r.People[0].Overdue != 1 {
		t.Fatalf("people: %+v", r.People)
	}
	if len(r.Projects) != 1 || r.Projects[0].Total != 5 || r.Projects[0].Done != 3 || r.Projects[0].DoneInPeriod != 2 || r.Projects[0].DonePrev != 1 {
		t.Fatalf("projects: %+v", r.Projects)
	}
	// Weeks: Oct 5 (Mon) and Oct 12 (Mon) cover Oct 8..14.
	if len(r.Weekly) != 2 || r.Weekly[0].Done != 1 || r.Weekly[1].Done != 1 {
		t.Fatalf("weekly: %+v", r.Weekly)
	}
}

func TestBuildPerformanceEmpty(t *testing.T) {
	r := service.BuildPerformance(nil, perfNow, 30)
	if r.Cycle.AvgHours != nil || r.Lead.AvgHours != nil || len(r.Daily) != 30 || len(r.Histogram) == 0 {
		t.Fatalf("empty workspace: %+v", r)
	}
}

func TestReopenedTaskMeasuresTheLastStretch(t *testing.T) {
	c := repository.PerfCard{ID: uuid.New(), Status: domain.Done, CreatedAt: at(1, 9), CompletedAt: func() *time.Time { d := at(13, 9); return &d }(),
		Steps: []repository.PerfStep{step(domain.Todo, at(1, 9)), step(domain.InProgress, at(2, 9)), step(domain.Done, at(3, 9)),
			step(domain.InProgress, at(12, 9)), step(domain.Done, at(13, 9))}}
	r := service.BuildPerformance([]repository.PerfCard{c}, perfNow, 7)
	if r.Throughput[0] != 1 || r.Cycle.AvgHours == nil || *r.Cycle.AvgHours != 24 {
		t.Fatalf("reopened: %+v", r.Cycle)
	}
}

func TestPerformanceNeedsThePermission(t *testing.T) {
	f := setup(t)
	f.card(t, "Visible")
	_, err := f.Cards.Performance(f.ctx, f.member, f.ws, 30, service.PerformanceFilter{})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	rep, err := f.Cards.Performance(f.ctx, f.owner, f.ws, 30, service.PerformanceFilter{})
	if err != nil || rep.Days != 30 || len(rep.Projects) != 1 || rep.Projects[0].Ref.Name != "Kanban Core" || rep.WIPInProgress != 0 {
		t.Fatalf("owner report: %+v %v", rep, err)
	}
	if rep.Daily[len(rep.Daily)-1].Todo != 1 {
		t.Fatalf("the new task shows in flow: %+v", rep.Daily[len(rep.Daily)-1])
	}
}
