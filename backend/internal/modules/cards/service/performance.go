package service

import (
	"context"
	"slices"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

// PerfPeriods are the windows the page offers, in days.
var PerfPeriods = []int{7, 30, 90}

// Duration summarises how long tasks took, in hours. Median keeps a few very slow tasks from skewing the picture.
// Nil means nothing finished in that period, so there is nothing to average.
type Duration struct {
	AvgHours, MedianHours, PreviousAvgHours *float64
	Samples                                 int
}

// PerfDay is one day of the cumulative views.
type PerfDay struct {
	Date                             time.Time
	Todo, InProgress, InReview, Done int // cumulative flow: tasks in each status at the end of the day
	CreatedTotal, DoneTotal          int // burn-up: created / closed since the period began
}

// PerfWeek is the throughput of one week (starting Monday).
type PerfWeek struct {
	Start         time.Time
	Created, Done int
}

// PerfBucket counts tasks whose cycle time fell below UpToDays (the last bucket has no upper bound).
type PerfBucket struct {
	UpToDays *int
	Count    int
}

// PerfAged is a task that has been in progress for a long time.
type PerfAged struct {
	ID, ProjectID uuid.UUID
	Number        int
	Title         string
	Status        domain.Status
	AgeHours      float64
	Assignees     []uuid.UUID
}

// PerfPerson is one person's current load and what they closed in the period.
type PerfPerson struct {
	User                usersdomain.User
	Open, Done, Overdue int
}

// PerfProject is one project's progress and speed.
type PerfProject struct {
	Ref                                          projectsdomain.Ref
	Total, Done, Overdue, DoneInPeriod, DonePrev int
}

// PerfReport is everything the Performance page shows.
type PerfReport struct {
	Days                          int
	Throughput                    [2]int // this period, the one before
	Cycle, Lead                   Duration
	LateDone, DoneWithDue         int // closed after their due date / closed with a due date, this period
	PrevLateDone, PrevDoneWithDue int
	OverdueNow                    int
	WIPInProgress, WIPInReview    int
	Weekly                        []PerfWeek
	Daily                         []PerfDay
	Histogram                     []PerfBucket
	Aged                          []PerfAged
	People                        []PerfPerson
	UnassignedOpen                int
	Projects                      []PerfProject

	// Lookups for presenting Aged (people and projects by id).
	users       map[uuid.UUID]usersdomain.User
	projectRefs map[uuid.UUID]projectsdomain.Ref
}

// User and Project resolve ids carried by Aged entries.
func (r PerfReport) User(id uuid.UUID) (usersdomain.User, bool) { u, ok := r.users[id]; return u, ok }
func (r PerfReport) Project(id uuid.UUID) projectsdomain.Ref    { return r.projectRefs[id] }

var histogramEdges = []int{1, 2, 3, 5, 8, 13}

func isWorking(s domain.Status) bool { return s == domain.InProgress || s == domain.InReview }

func midnight(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func hoursBetween(a, b time.Time) float64 { return b.Sub(a).Hours() }

func summarise(cur, prev []float64) Duration {
	d := Duration{Samples: len(cur)}
	if len(cur) > 0 {
		avg := mean(cur)
		med := median(cur)
		d.AvgHours, d.MedianHours = &avg, &med
	}
	if len(prev) > 0 {
		p := mean(prev)
		d.PreviousAvgHours = &p
	}
	return d
}

func mean(v []float64) float64 {
	s := 0.0
	for _, x := range v {
		s += x
	}
	return s / float64(len(v))
}

func median(v []float64) float64 {
	c := slices.Clone(v)
	sort.Float64s(c)
	n := len(c)
	if n%2 == 1 {
		return c[n/2]
	}
	return (c[n/2-1] + c[n/2]) / 2
}

// perfFlow is what the status history says about one task.
type perfFlow struct {
	workStart *time.Time // when the stretch of work that ended in "done" (or is still going) began
}

// flowOf finds when the latest stretch of work began: entering In progress / In review from To do or Done
// starts it; moving between the two work statuses continues it; going back to To do ends it.
// For a finished task that is the stretch which ended in Done.
func flowOf(c repository.PerfCard) perfFlow {
	var start, finished *time.Time
	prev := domain.Status("")
	for _, s := range c.Steps {
		at := s.At
		switch {
		case isWorking(s.To) && !isWorking(prev):
			start = &at
		case s.To == domain.Todo:
			start = nil
		case s.To == domain.Done:
			finished = start
			start = nil
		}
		prev = s.To
	}
	if c.Status == domain.Done {
		return perfFlow{workStart: finished}
	}
	return perfFlow{workStart: start}
}

// statusAt is the task's status at a moment, or "" before it existed.
func statusAt(c repository.PerfCard, at time.Time) domain.Status {
	st := domain.Status("")
	for _, s := range c.Steps {
		if s.At.After(at) {
			break
		}
		st = s.To
	}
	return st
}

// BuildPerformance derives the report from tasks and their history. It is pure: now and the data are its only inputs.
func BuildPerformance(cards []repository.PerfCard, now time.Time, days int) PerfReport {
	today := midnight(now)
	start := today.AddDate(0, 0, -(days - 1))
	prevStart := start.AddDate(0, 0, -days)
	rep := PerfReport{Days: days}
	inPeriod := func(t *time.Time) bool { return t != nil && !t.Before(start) && !t.After(now) }
	inPrev := func(t *time.Time) bool { return t != nil && !t.Before(prevStart) && t.Before(start) }
	late := func(c repository.PerfCard) bool {
		return c.DueDate != nil && c.CompletedAt != nil && midnight(*c.CompletedAt).After(midnight(*c.DueDate))
	}

	// Daily cumulative views.
	rep.Daily = make([]PerfDay, days)
	for i := range rep.Daily {
		rep.Daily[i].Date = start.AddDate(0, 0, i)
	}
	// Weekly throughput: Mondays from the week of the period's first day to today's week.
	weekOf := func(t time.Time) time.Time {
		t = midnight(t)
		return t.AddDate(0, 0, -((int(t.Weekday()) + 6) % 7))
	}
	weekIdx := map[time.Time]int{}
	for w := weekOf(start); !w.After(today); w = w.AddDate(0, 0, 7) {
		weekIdx[w] = len(rep.Weekly)
		rep.Weekly = append(rep.Weekly, PerfWeek{Start: w})
	}

	var cycleCur, cyclePrev, leadCur, leadPrev []float64
	buckets := make([]int, len(histogramEdges)+1)
	people := map[uuid.UUID]*PerfPerson{}
	projects := map[uuid.UUID]*PerfProject{}
	person := func(id uuid.UUID) *PerfPerson {
		if p, ok := people[id]; ok {
			return p
		}
		p := &PerfPerson{User: usersdomain.User{ID: id}}
		people[id] = p
		return p
	}

	for _, c := range cards {
		proj := projects[c.ProjectID]
		if proj == nil {
			proj = &PerfProject{Ref: projectsdomain.Ref{ID: c.ProjectID}}
			projects[c.ProjectID] = proj
		}
		proj.Total++
		done := c.Status == domain.Done
		overdue := !done && c.DueDate != nil && midnight(*c.DueDate).Before(today)
		if done {
			proj.Done++
		}
		if overdue {
			proj.Overdue++
			rep.OverdueNow++
		}
		if c.Status == domain.InProgress {
			rep.WIPInProgress++
		}
		if c.Status == domain.InReview {
			rep.WIPInReview++
		}
		if !done {
			if len(c.Assignees) == 0 {
				rep.UnassignedOpen++
			}
		}
		for _, a := range c.Assignees {
			p := person(a)
			if !done {
				p.Open++
			}
			if overdue {
				p.Overdue++
			}
			if done && inPeriod(c.CompletedAt) {
				p.Done++
			}
		}

		// Created in the period: weekly bars and the burn-up.
		if !c.CreatedAt.Before(start) && !c.CreatedAt.After(now) {
			if i, ok := weekIdx[weekOf(c.CreatedAt)]; ok {
				rep.Weekly[i].Created++
			}
			di := int(midnight(c.CreatedAt).Sub(start).Hours() / 24)
			if di >= 0 && di < days {
				rep.Daily[di].CreatedTotal++
			}
		}

		if done {
			flow := flowOf(c)
			switch {
			case inPeriod(c.CompletedAt):
				rep.Throughput[0]++
				proj.DoneInPeriod++
				if i, ok := weekIdx[weekOf(*c.CompletedAt)]; ok {
					rep.Weekly[i].Done++
				}
				di := int(midnight(*c.CompletedAt).Sub(start).Hours() / 24)
				if di >= 0 && di < days {
					rep.Daily[di].DoneTotal++
				}
				leadCur = append(leadCur, hoursBetween(c.CreatedAt, *c.CompletedAt))
				if flow.workStart != nil {
					h := hoursBetween(*flow.workStart, *c.CompletedAt)
					cycleCur = append(cycleCur, h)
					cycleDays := h / 24
					b := len(histogramEdges)
					for i, edge := range histogramEdges {
						if cycleDays < float64(edge) {
							b = i
							break
						}
					}
					buckets[b]++
				}
				if c.DueDate != nil {
					rep.DoneWithDue++
					if late(c) {
						rep.LateDone++
					}
				}
			case inPrev(c.CompletedAt):
				rep.Throughput[1]++
				proj.DonePrev++
				leadPrev = append(leadPrev, hoursBetween(c.CreatedAt, *c.CompletedAt))
				if flow.workStart != nil {
					cyclePrev = append(cyclePrev, hoursBetween(*flow.workStart, *c.CompletedAt))
				}
				if c.DueDate != nil {
					rep.PrevDoneWithDue++
					if late(c) {
						rep.PrevLateDone++
					}
				}
			}
		} else if isWorking(c.Status) {
			if f := flowOf(c); f.workStart != nil {
				rep.Aged = append(rep.Aged, PerfAged{ID: c.ID, ProjectID: c.ProjectID, Number: c.Number, Title: c.Title,
					Status: c.Status, AgeHours: hoursBetween(*f.workStart, now), Assignees: c.Assignees})
			}
		}
	}

	// Cumulative flow: each task's status at the end of every day of the period.
	for i := range rep.Daily {
		end := rep.Daily[i].Date.AddDate(0, 0, 1).Add(-time.Nanosecond)
		if end.After(now) {
			end = now
		}
		for _, c := range cards {
			switch statusAt(c, end) {
			case domain.Todo:
				rep.Daily[i].Todo++
			case domain.InProgress:
				rep.Daily[i].InProgress++
			case domain.InReview:
				rep.Daily[i].InReview++
			case domain.Done:
				rep.Daily[i].Done++
			}
		}
	}
	// Burn-up is cumulative.
	for i := 1; i < len(rep.Daily); i++ {
		rep.Daily[i].CreatedTotal += rep.Daily[i-1].CreatedTotal
		rep.Daily[i].DoneTotal += rep.Daily[i-1].DoneTotal
	}

	rep.Cycle, rep.Lead = summarise(cycleCur, cyclePrev), summarise(leadCur, leadPrev)
	for i, n := range buckets {
		b := PerfBucket{Count: n}
		if i < len(histogramEdges) {
			e := histogramEdges[i]
			b.UpToDays = &e
		}
		rep.Histogram = append(rep.Histogram, b)
	}
	sort.Slice(rep.Aged, func(i, j int) bool { return rep.Aged[i].AgeHours > rep.Aged[j].AgeHours })
	if len(rep.Aged) > 8 {
		rep.Aged = rep.Aged[:8]
	}
	for _, p := range people {
		rep.People = append(rep.People, *p)
	}
	sort.Slice(rep.People, func(i, j int) bool {
		a, b := rep.People[i], rep.People[j]
		if a.Open != b.Open {
			return a.Open > b.Open
		}
		return a.User.ID.String() < b.User.ID.String()
	})
	for _, p := range projects {
		rep.Projects = append(rep.Projects, *p)
	}
	sort.Slice(rep.Projects, func(i, j int) bool {
		a, b := rep.Projects[i], rep.Projects[j]
		if a.Total != b.Total {
			return a.Total > b.Total
		}
		return a.Ref.ID.String() < b.Ref.ID.String()
	})
	return rep
}

// PerformanceFilter narrows the report.
type PerformanceFilter = repository.PerfFilter

// Performance builds the team-performance report (needs the analytics permission, which administrators have).
func (s *Service) Performance(ctx context.Context, user, ws uuid.UUID, days int, f PerformanceFilter) (PerfReport, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermAnalytics); err != nil {
		return PerfReport{}, err
	}
	if !slices.Contains(PerfPeriods, days) {
		days = 30
	}
	cards, err := s.repo.PerformanceData(ctx, ws, f)
	if err != nil {
		return PerfReport{}, err
	}
	rep := BuildPerformance(cards, s.now(), days)

	projectIDs := make([]uuid.UUID, len(rep.Projects))
	for i, p := range rep.Projects {
		projectIDs[i] = p.Ref.ID
	}
	for _, a := range rep.Aged {
		if !slices.Contains(projectIDs, a.ProjectID) {
			projectIDs = append(projectIDs, a.ProjectID)
		}
	}
	refs, err := s.projects.Refs(ctx, projectIDs)
	if err != nil {
		return PerfReport{}, err
	}
	for i := range rep.Projects {
		rep.Projects[i].Ref = refs[rep.Projects[i].Ref.ID]
	}
	userIDs := []uuid.UUID{}
	for _, p := range rep.People {
		userIDs = append(userIDs, p.User.ID)
	}
	for _, a := range rep.Aged {
		for _, id := range a.Assignees {
			if !slices.Contains(userIDs, id) {
				userIDs = append(userIDs, id)
			}
		}
	}
	if len(userIDs) > 0 {
		us, err := s.users.GetMany(ctx, userIDs)
		if err != nil {
			return PerfReport{}, err
		}
		byID := map[uuid.UUID]usersdomain.User{}
		for _, u := range us {
			byID[u.ID] = u
		}
		for i := range rep.People {
			if u, ok := byID[rep.People[i].User.ID]; ok {
				rep.People[i].User = u
			}
		}
		// A person who left the workspace has no profile to show; they stay out of the comparison.
		kept := rep.People[:0]
		for _, p := range rep.People {
			if p.User.Name != "" {
				kept = append(kept, p)
			}
		}
		rep.People = kept
		rep.users = byID
	}
	rep.projectRefs = refs
	return rep, nil
}
