package service_test

import (
	"context"
	"testing"

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
