package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func day(s string) *time.Time {
	d, _ := time.Parse(time.DateOnly, s)
	return &d
}

func ptr[T any](v T) *T { return &v }

func TestDeriveKey(t *testing.T) {
	cases := map[string]string{
		"Kanban Core":                "KC",
		"Website SEO Optimization":   "WSO",
		"Onboarding":                 "ONBO",
		"Платформа Core API Gateway": "CAG",
		"Проєкт":                     "PRJ",
		"Q3 Roadmap Planning Sync X": "QRPS",
	}
	for in, want := range cases {
		if got := service.DeriveKey(in); got != want {
			t.Errorf("DeriveKey(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCreateProvisionsBoardAndKeys(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	viewer := e.User("Viewer", "v@example.com")
	stranger := e.User("Stranger", "s@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{viewer: wsdomain.RoleViewer}, tdb.Pool)

	p, err := e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "Kanban Core", PICID: &owner, Team: ptr(" Engineering ")}, "uk")
	if err != nil {
		t.Fatal(err)
	}
	if p.Key != "KC" || p.Status != domain.StatusPending || p.PIC == nil || p.PIC.Name != "Owner" || *p.PICRole != wsdomain.RoleOwner || *p.Team != "Engineering" {
		t.Fatalf("unexpected project %+v", p)
	}
	b, err := e.Boards.Board(ctx, owner, p.ID)
	if err != nil || len(b.Columns) != 4 || b.Columns[0].Name != "До виконання" || b.Columns[3].Category != "done" {
		t.Fatalf("default board: %+v %v", b, err)
	}

	p2, err := e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "Kanban Clone"}, "en")
	if err != nil || p2.Key != "KC2" {
		t.Fatalf("derived key collision should add a suffix: %+v %v", p2, err)
	}
	_, err = e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "X", Key: "kc"}, "en")
	mustCode(t, err, domain.ErrKeyTaken)
	_, err = e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "X", Key: "1bad"}, "en")
	mustCode(t, err, apperr.Validation)
	_, err = e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "X", PICID: &stranger}, "en")
	mustCode(t, err, apperr.Validation)
	_, err = e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "X", StartDate: day("2026-05-02"), Deadline: day("2026-05-01")}, "en")
	mustCode(t, err, apperr.Validation)

	_, err = e.Projects.Create(ctx, viewer, ws, service.CreateInput{Name: "Nope"}, "en")
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = e.Projects.Get(ctx, stranger, p.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestListFiltersSortAndSummary(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	ws := e.Workspace(owner, nil, tdb.Pool)
	today := e.Projects.Today()
	past := today.AddDate(0, 0, -3)
	soon := today.AddDate(0, 0, 3)

	mk := func(name string, status domain.Status, team string, deadline *time.Time) service.View {
		v, err := e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: name, Status: status, Team: &team, Deadline: deadline}, "en")
		if err != nil {
			t.Fatal(err)
		}
		return v
	}
	late := mk("Late Launch", domain.StatusInProgress, "Marketing", &past)
	mk("Soon Release", domain.StatusPending, "Engineering", &soon)
	done := mk("Done Deal", domain.StatusCompleted, "Engineering", &past)

	// Two cards, one done → 50 % progress on "Late Launch".
	c1, _ := e.Cards.Create(ctx, owner, ws, carddomain.NewCard{ProjectID: late.ID, Title: "A"})
	_, _ = e.Cards.Create(ctx, owner, ws, carddomain.NewCard{ProjectID: late.ID, Title: "B"})
	if _, err := e.Cards.Move(ctx, owner, c1.ID, carddomain.Move{Version: c1.Version, Status: ptr(carddomain.Done)}); err != nil {
		t.Fatal(err)
	}

	list := func(f domain.Filter) []string {
		views, total, err := e.Projects.List(ctx, owner, ws, f, pagination.Params{Page: 1, Size: 10})
		if err != nil {
			t.Fatal(err)
		}
		if total != len(views) {
			t.Fatalf("total %d != %d", total, len(views))
		}
		out := []string{}
		for _, v := range views {
			out = append(out, v.Name)
		}
		return out
	}
	eq := func(got []string, want ...string) {
		t.Helper()
		if len(got) != len(want) {
			t.Fatalf("got %v want %v", got, want)
		}
		for i := range got {
			if got[i] != want[i] {
				t.Fatalf("got %v want %v", got, want)
			}
		}
	}
	eq(list(domain.Filter{Sort: "name"}), "Done Deal", "Late Launch", "Soon Release")
	eq(list(domain.Filter{Deadline: "overdue"}), "Late Launch")
	eq(list(domain.Filter{Deadline: "week", Sort: "name"}), "Soon Release")
	eq(list(domain.Filter{Team: ptr("Engineering"), Sort: "name", Desc: true}), "Soon Release", "Done Deal")
	eq(list(domain.Filter{Progress: "midway"}), "Late Launch")
	eq(list(domain.Filter{Progress: "done"}), "Done Deal")
	eq(list(domain.Filter{Query: "rel"}), "Soon Release")
	eq(list(domain.Filter{Query: "100%_"}))
	eq(list(domain.Filter{Sort: "progress", Desc: true}), "Done Deal", "Late Launch", "Soon Release")

	got, _ := e.Projects.Get(ctx, owner, late.ID)
	if got.TaskCount != 2 || got.DoneCount != 1 || got.Progress() != 50 || !got.Overdue {
		t.Fatalf("counters: %+v", got)
	}
	if done.Overdue {
		t.Fatal("completed projects are never overdue")
	}

	s, err := e.Projects.Summary(ctx, owner, ws)
	if err != nil || s.Total != 3 || s.Completed != 1 || s.InProgress != 1 || s.Pending != 1 || s.Overdue != 1 || len(s.Teams) != 2 {
		t.Fatalf("summary %+v %v", s, err)
	}
}

func TestUpdateAndArchive(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember}, tdb.Pool)
	p, _ := e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "Core", PICID: &owner, Team: ptr("Eng"), Deadline: day("2030-01-01")}, "en")

	upd, err := e.Projects.Update(ctx, member, p.ID, domain.Patch{
		Name: ptr(" Core v2 "), Status: ptr(domain.StatusInProgress), SetPIC: true, PICID: &member, SetTeam: true, SetDeadline: true,
	})
	if err != nil || upd.Name != "Core v2" || upd.Team != nil || upd.Deadline != nil || upd.PIC.Name != "Member" || upd.Status != domain.StatusInProgress {
		t.Fatalf("update: %+v %v", upd, err)
	}
	_, err = e.Projects.Update(ctx, owner, p.ID, domain.Patch{Tone: ptr("pink")})
	mustCode(t, err, apperr.Validation)

	mustCode(t, e.Projects.Archive(ctx, member, p.ID), wsdomain.ErrInsufficientRole)
	if err := e.Projects.Archive(ctx, owner, p.ID); err != nil {
		t.Fatal(err)
	}
	_, err = e.Projects.Get(ctx, owner, p.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestProjectCreationPermission(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	member := e.User("Member", "m@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember}, tdb.Pool)

	if _, err := e.Projects.Create(ctx, member, ws, service.CreateInput{Name: "Open"}, "en"); err != nil {
		t.Fatalf("members create projects by default: %v", err)
	}
	var keep []wsdomain.Permission
	for _, p := range wsdomain.RoleDefaults(wsdomain.RoleMember) {
		if p != wsdomain.PermProjectCreate {
			keep = append(keep, p)
		}
	}
	if err := e.Workspaces.SetRolePermissions(ctx, owner, ws, wsdomain.RoleMember, keep); err != nil {
		t.Fatal(err)
	}
	_, err := e.Projects.Create(ctx, member, ws, service.CreateInput{Name: "Closed"}, "en")
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	if _, err := e.Projects.Create(ctx, owner, ws, service.CreateInput{Name: "By owner"}, "en"); err != nil {
		t.Fatalf("administrators still can: %v", err)
	}
}
