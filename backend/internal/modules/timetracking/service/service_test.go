package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func TestTimeTracking(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	other := e.User("Other", "x@example.com")
	viewer := e.User("Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, other: wsdomain.RoleMember,
		viewer: wsdomain.RoleViewer}, tdb.Pool)
	project := e.Project(owner, ws, "Core")
	a := e.Card(member, ws, project, "First")
	b := e.Card(member, ws, project, "Second")

	// One timer at a time: starting on B stops the one on A.
	first, err := e.Time.Start(ctx, member, a.ID)
	if err != nil || !first.Running() || first.User == nil {
		t.Fatalf("start: %+v %v", first, err)
	}
	second, err := e.Time.Start(ctx, member, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	run, err := e.Time.Running(ctx, member)
	if err != nil || run == nil || run.ID != second.ID {
		t.Fatalf("running timer: %+v %v", run, err)
	}
	sum, err := e.Time.List(ctx, member, a.ID)
	if err != nil || len(sum.Entries) != 1 || sum.Entries[0].Running() {
		t.Fatalf("A's timer should have been stopped: %+v %v", sum, err)
	}

	stopped, err := e.Time.Stop(ctx, member, second.ID)
	if err != nil || stopped.Running() || stopped.EndedAt == nil {
		t.Fatalf("stop: %+v %v", stopped, err)
	}
	_, err = e.Time.Stop(ctx, member, second.ID)
	mustCode(t, err, domain.ErrNotActive)
	if run, _ := e.Time.Running(ctx, member); run != nil {
		t.Fatal("no timer should be running")
	}
	// Someone else's entry is invisible, not forbidden.
	third, _ := e.Time.Start(ctx, member, a.ID)
	_, err = e.Time.Stop(ctx, other, third.ID)
	mustCode(t, err, domain.ErrNotFound)

	// Manual entries are bounded.
	logged, err := e.Time.Log(ctx, member, a.ID, service.LogInput{Seconds: 5400, Note: "  pairing  "})
	if err != nil || logged.Seconds != 5400 || logged.Note != "pairing" || !logged.Manual {
		t.Fatalf("log: %+v %v", logged, err)
	}
	for _, secs := range []int{0, 59, domain.MaxManualSeconds + 1} {
		if _, err := e.Time.Log(ctx, member, a.ID, service.LogInput{Seconds: secs}); err == nil {
			t.Fatalf("%d seconds must be rejected", secs)
		}
	}
	sum, _ = e.Time.List(ctx, member, a.ID)
	if sum.TotalSeconds < 5400 || len(sum.Entries) != 3 {
		t.Fatalf("total %d over %d entries", sum.TotalSeconds, len(sum.Entries))
	}

	// Viewers can read but not track.
	if _, err := e.Time.List(ctx, viewer, a.ID); err != nil {
		t.Fatal(err)
	}
	_, err = e.Time.Start(ctx, viewer, a.ID)
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	// Delete: the author or an admin, nobody else.
	if err := e.Time.Delete(ctx, other, logged.ID); !apperr.IsCode(err, domain.ErrForbidden) {
		t.Fatalf("other member deleting: %v", err)
	}
	if err := e.Time.Delete(ctx, member, logged.ID); err != nil {
		t.Fatal(err)
	}
	third2, _ := e.Time.Log(ctx, member, a.ID, service.LogInput{Seconds: 600})
	if err := e.Time.Delete(ctx, owner, third2.ID); err != nil {
		t.Fatalf("admin delete: %v", err)
	}
}

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func TestManualTimeCanBeSwitchedOff(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember}, tdb.Pool)
	card := e.Card(member, ws, e.Project(owner, ws, "Core"), "Task")
	off := false
	if _, err := e.Workspaces.UpdateSettings(ctx, owner, ws, wsdomain.SettingsPatch{TimeAllowManual: &off}); err != nil {
		t.Fatal(err)
	}
	_, err := e.Time.Log(ctx, member, card.ID, service.LogInput{Seconds: 600})
	mustCode(t, err, wsdomain.ErrPolicy)
	// Timers are unaffected.
	if _, err := e.Time.Start(ctx, member, card.ID); err != nil {
		t.Fatalf("a timer still works: %v", err)
	}
}

func TestEstimateTimesheetAndEditing(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	other := e.User("Other", "x@example.com")
	viewer := e.User("Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, other: wsdomain.RoleMember,
		viewer: wsdomain.RoleViewer}, tdb.Pool)
	project := e.Project(owner, ws, "Core")
	card := e.Card(member, ws, project, "Plan the launch")

	// Estimate: whole minutes, bounded, cleared with nil, members only.
	five := 5*3600 + 20
	got, err := e.Time.SetEstimate(ctx, member, card.ID, &five)
	if err != nil || got == nil || *got != 5*3600+60*0 {
		t.Fatalf("estimate rounds to whole minutes: %v %v", got, err)
	}
	sum, _ := e.Time.List(ctx, member, card.ID)
	if sum.EstimateSeconds == nil || *sum.EstimateSeconds != 5*3600 {
		t.Fatalf("summary carries the estimate: %v", sum.EstimateSeconds)
	}
	tiny := 10
	_, err = e.Time.SetEstimate(ctx, member, card.ID, &tiny)
	mustCode(t, err, apperr.Validation)
	_, err = e.Time.SetEstimate(ctx, viewer, card.ID, &five)
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	if _, err := e.Time.SetEstimate(ctx, member, card.ID, nil); err != nil {
		t.Fatal(err)
	}
	if sum, _ = e.Time.List(ctx, member, card.ID); sum.EstimateSeconds != nil {
		t.Fatalf("estimate cleared: %v", sum.EstimateSeconds)
	}

	// Timesheet: a backdated entry shows in its period with its task; running timers too.
	day := time.Now().UTC().Truncate(24 * time.Hour).Add(-48 * time.Hour).Add(9 * time.Hour)
	if _, err := e.Time.Log(ctx, member, card.ID, service.LogInput{Seconds: 3600, Note: "kick-off", StartedAt: &day}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Time.Start(ctx, member, card.ID); err != nil {
		t.Fatal(err)
	}
	q := service.SheetQuery{From: day.Add(-24 * time.Hour), To: time.Now().Add(24 * time.Hour)}
	sheet, err := e.Time.Timesheet(ctx, member, ws, q)
	if err != nil || len(sheet.Entries) != 2 || sheet.Entries[0].CardTitle != "Plan the launch" || sheet.Entries[0].Project.Name != "Core" {
		t.Fatalf("sheet: %+v %v", sheet, err)
	}
	if sheet.TotalSeconds < 3600 {
		t.Fatalf("total counts the logged hour: %d", sheet.TotalSeconds)
	}
	// An earlier window does not include it; someone else's time needs the permission; a huge window is refused.
	earlier := service.SheetQuery{From: day.Add(-72 * time.Hour), To: day.Add(-48 * time.Hour)}
	if s, _ := e.Time.Timesheet(ctx, member, ws, earlier); len(s.Entries) != 0 {
		t.Fatalf("outside the period: %+v", s.Entries)
	}
	q.UserID = &member
	if _, err := e.Time.Timesheet(ctx, other, ws, service.SheetQuery{From: q.From, To: q.To, UserID: &member}); !apperr.IsCode(err, domain.ErrForbidden) {
		t.Fatalf("a colleague must not read it: %v", err)
	}
	if s, err := e.Time.Timesheet(ctx, owner, ws, service.SheetQuery{From: q.From, To: q.To, UserID: &member}); err != nil || len(s.Entries) != 2 {
		t.Fatalf("the owner manages time: %+v %v", s.Entries, err)
	}
	_, err = e.Time.Timesheet(ctx, member, ws, service.SheetQuery{From: day.AddDate(-1, 0, 0), To: day})
	mustCode(t, err, apperr.Validation)

	// Editing: the author changes a stopped entry; a running one must be stopped first; others are refused.
	var logged, running service.SheetEntry
	for _, en := range sheet.Entries {
		if en.Running() {
			running = en
		} else {
			logged = en
		}
	}
	ninety := 5400
	note := "  kick-off call  "
	upd, err := e.Time.Update(ctx, member, logged.ID, service.UpdateInput{Seconds: &ninety, Note: &note})
	if err != nil || upd.Seconds != 5400 || upd.Note != "kick-off call" || upd.EndedAt == nil || !upd.EndedAt.Equal(upd.StartedAt.Add(90*time.Minute)) {
		t.Fatalf("update: %+v %v", upd, err)
	}
	_, err = e.Time.Update(ctx, member, running.ID, service.UpdateInput{Seconds: &ninety})
	mustCode(t, err, domain.ErrRunning)
	_, err = e.Time.Update(ctx, other, logged.ID, service.UpdateInput{Seconds: &ninety})
	mustCode(t, err, domain.ErrForbidden)
	if _, err := e.Time.Update(ctx, owner, logged.ID, service.UpdateInput{Seconds: &ninety}); err != nil {
		t.Fatalf("a time manager may edit: %v", err)
	}
	zero := 0
	_, err = e.Time.Update(ctx, member, logged.ID, service.UpdateInput{Seconds: &zero})
	mustCode(t, err, apperr.Validation)
}
