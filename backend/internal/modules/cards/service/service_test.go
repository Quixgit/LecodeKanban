package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	projectsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func ptr[T any](v T) *T { return &v }

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

type fixture struct {
	*testkit.Env
	ctx                    context.Context
	owner, member, viewer  uuid.UUID
	ws, project, otherProj uuid.UUID
}

func setup(t *testing.T) fixture {
	t.Helper()
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	f := fixture{Env: e, ctx: context.Background()}
	f.owner = e.User("Olena Owner", "o@example.com")
	f.member = e.User("Maria Member", "m@example.com")
	f.viewer = e.User("Vira Viewer", "v@example.com")
	f.ws = e.Workspace(f.owner, map[uuid.UUID]wsdomain.Role{f.member: wsdomain.RoleMember, f.viewer: wsdomain.RoleViewer}, tdb.Pool)
	p, err := e.Projects.Create(f.ctx, f.owner, f.ws, projectsvc.CreateInput{Name: "Kanban Core"}, "en")
	if err != nil {
		t.Fatal(err)
	}
	q, _ := e.Projects.Create(f.ctx, f.owner, f.ws, projectsvc.CreateInput{Name: "Website"}, "en")
	f.project, f.otherProj = p.ID, q.ID
	return f
}

func (f fixture) card(t *testing.T, title string, mods ...func(*domain.NewCard)) service.View {
	t.Helper()
	in := domain.NewCard{ProjectID: f.project, Title: title}
	for _, m := range mods {
		m(&in)
	}
	v, err := f.Cards.Create(f.ctx, f.member, f.ws, in)
	if err != nil {
		t.Fatalf("create %s: %v", title, err)
	}
	return v
}

func TestCreateValidationAndNumbering(t *testing.T) {
	f := setup(t)
	a := f.card(t, "  First  ", func(c *domain.NewCard) { c.AssigneeIDs = []uuid.UUID{f.member, f.owner, f.member} })
	b := f.card(t, "Second", func(c *domain.NewCard) { c.Status = domain.Done; c.Priority = domain.High })
	if a.Key != "KC-1" || b.Key != "KC-2" || a.Title != "First" || a.Status != domain.Todo || a.Priority != domain.Medium {
		t.Fatalf("unexpected cards %+v / %+v", a.Card, b.Card)
	}
	if len(a.Assignees) != 2 || a.Assignees[0].Name != "Maria Member" {
		t.Fatalf("assignees must be de-duplicated and sorted: %+v", a.Assignees)
	}
	if b.Status != domain.Done || b.Progress != 100 || b.CompletedAt == nil {
		t.Fatalf("done cards are complete: %+v", b.Card)
	}

	stranger := f.User("Stranger", "s@example.com")
	_, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: " ", Priority: "urgent", AssigneeIDs: []uuid.UUID{stranger}, LabelIDs: []uuid.UUID{uuid.New()}})
	mustCode(t, err, apperr.Validation)
	if n := len(apperr.From(err).Fields); n != 4 {
		t.Fatalf("expected 4 field errors (title, priority, assignees, labels), got %v", apperr.From(err).Fields)
	}
	_, err = f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: uuid.New(), Title: "x"})
	mustCode(t, err, apperr.Validation)
	_, err = f.Cards.Create(f.ctx, f.viewer, f.ws, domain.NewCard{ProjectID: f.project, Title: "x"})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = f.Cards.Get(f.ctx, stranger, a.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestUpdateOptimisticConcurrency(t *testing.T) {
	f := setup(t)
	c := f.card(t, "Draft")
	due, _ := time.Parse(time.DateOnly, "2030-02-03")
	u, err := f.Cards.Update(f.ctx, f.member, c.ID, domain.Patch{Version: c.Version, Title: ptr("Final"), SetDue: true, DueDate: &due,
		AssigneeIDs: &[]uuid.UUID{f.owner}})
	if err != nil || u.Title != "Final" || u.Version != c.Version+1 || u.DueDate == nil || len(u.Assignees) != 1 || u.Progress != 0 {
		t.Fatalf("update: %+v %v", u.Card, err)
	}
	_, err = f.Cards.Update(f.ctx, f.owner, c.ID, domain.Patch{Version: c.Version, Title: ptr("Stale")})
	mustCode(t, err, domain.ErrVersionConflict)
	if apperr.From(err).Meta["currentVersion"] == nil {
		t.Fatal("conflict must report the current version")
	}
	cleared, err := f.Cards.Update(f.ctx, f.member, c.ID, domain.Patch{Version: u.Version, SetDue: true, AssigneeIDs: &[]uuid.UUID{}})
	if err != nil || cleared.DueDate != nil || len(cleared.Assignees) != 0 {
		t.Fatalf("clear: %+v %v", cleared.Card, err)
	}
	_, err = f.Cards.Update(f.ctx, f.viewer, c.ID, domain.Patch{Version: cleared.Version, Title: ptr("x")})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
}

func TestMoveOrderingAndTransitions(t *testing.T) {
	f := setup(t)
	a, b, c := f.card(t, "A"), f.card(t, "B"), f.card(t, "C")
	order := func(status domain.Status) []string {
		views, _, err := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{Status: &status, Sort: "position"}, pagination.Params{Page: 1, Size: 50})
		if err != nil {
			t.Fatal(err)
		}
		out := []string{}
		for _, v := range views {
			out = append(out, v.Title)
		}
		return out
	}
	assertOrder := func(status domain.Status, want ...string) {
		t.Helper()
		got := order(status)
		if len(got) != len(want) {
			t.Fatalf("%s: got %v want %v", status, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("%s: got %v want %v", status, got, want)
			}
		}
	}
	assertOrder(domain.Todo, "A", "B", "C")

	// Reorder within the column: C between A and B.
	moved, err := f.Cards.Move(f.ctx, f.member, c.ID, domain.Move{Version: c.Version, AfterID: &a.ID, BeforeID: &b.ID})
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(domain.Todo, "A", "C", "B")
	// Before-only and after-only placements.
	moved, err = f.Cards.Move(f.ctx, f.member, c.ID, domain.Move{Version: moved.Version, BeforeID: &a.ID})
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(domain.Todo, "C", "A", "B")
	if _, err = f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: a.Version, AfterID: &b.ID}); err != nil {
		t.Fatal(err)
	}
	assertOrder(domain.Todo, "C", "B", "A")

	// Across statuses: to review, then done (progress 100, completed).
	rev, err := f.Cards.Move(f.ctx, f.member, b.ID, domain.Move{Version: b.Version, Status: ptr(domain.InReview)})
	if err != nil || rev.Status != domain.InReview || rev.CompletedAt != nil {
		t.Fatalf("to review: %+v %v", rev.Card, err)
	}
	fin, err := f.Cards.Move(f.ctx, f.member, b.ID, domain.Move{Version: rev.Version, Status: ptr(domain.Done)})
	if err != nil || fin.Progress != 100 || fin.CompletedAt == nil {
		t.Fatalf("to done: %+v %v", fin.Card, err)
	}
	back, err := f.Cards.Move(f.ctx, f.member, b.ID, domain.Move{Version: fin.Version, Status: ptr(domain.InProgress)})
	if err != nil || back.CompletedAt != nil {
		t.Fatalf("reopen clears completion: %+v %v", back.Card, err)
	}

	// Invalid moves.
	_, err = f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: back.Version})
	mustCode(t, err, domain.ErrVersionConflict)
	cur, _ := f.Cards.Get(f.ctx, f.member, a.ID)
	_, err = f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: cur.Version, AfterID: &b.ID}) // b is in another column
	mustCode(t, err, domain.ErrInvalidMove)
	_, err = f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: cur.Version, AfterID: &c.ID, BeforeID: &c.ID})
	mustCode(t, err, domain.ErrInvalidMove)
	otherCol, err := f.Boards.FirstColumn(f.ctx, f.otherProj, "todo")
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: cur.Version, ColumnID: &otherCol.ID})
	mustCode(t, err, domain.ErrInvalidMove)

	// Transitions recorded: 3 creates + review + done + in_progress.
	var n int
	if err := tdb.Pool.QueryRow(f.ctx, `SELECT count(*) FROM card_transitions`).Scan(&n); err != nil || n != 6 {
		t.Fatalf("transitions = %d (%v)", n, err)
	}
}

func TestListFiltersSearchAndCounts(t *testing.T) {
	f := setup(t)
	today := time.Now().UTC().Truncate(24 * time.Hour)
	yesterday := today.AddDate(0, 0, -1)
	f.card(t, "Design login page", func(c *domain.NewCard) {
		c.Priority = domain.High
		c.AssigneeIDs = []uuid.UUID{f.member}
		c.DueDate = &yesterday
	})
	f.card(t, "Write API docs", func(c *domain.NewCard) { c.Status = domain.InReview; c.AssigneeIDs = []uuid.UUID{f.owner} })
	f.card(t, "Ship 100% coverage", func(c *domain.NewCard) { c.Status = domain.Done; c.Priority = domain.Low })
	if _, err := f.Cards.Create(f.ctx, f.owner, f.ws, domain.NewCard{ProjectID: f.otherProj, Title: "Landing page"}); err != nil {
		t.Fatal(err)
	}

	titles := func(fl domain.Filter) []string {
		views, total, err := f.Cards.List(f.ctx, f.viewer, f.ws, fl, pagination.Params{Page: 1, Size: 50})
		if err != nil {
			t.Fatal(err)
		}
		if total != len(views) {
			t.Fatalf("total mismatch")
		}
		out := []string{}
		for _, v := range views {
			out = append(out, v.Title)
		}
		return out
	}
	check := func(got []string, want ...string) {
		t.Helper()
		if len(got) != len(want) {
			t.Fatalf("got %v want %v", got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("got %v want %v", got, want)
			}
		}
	}
	check(titles(domain.Filter{Query: "page", Sort: "title"}), "Design login page", "Landing page")
	check(titles(domain.Filter{Query: "kc-2"}), "Write API docs")
	check(titles(domain.Filter{Query: "100%"}), "Ship 100% coverage")
	check(titles(domain.Filter{AssigneeID: &f.member}), "Design login page")
	check(titles(domain.Filter{Priority: ptr(domain.High)}), "Design login page")
	check(titles(domain.Filter{Due: "overdue"}), "Design login page")
	check(titles(domain.Filter{ProjectID: &f.otherProj}), "Landing page")
	check(titles(domain.Filter{Sort: "priority", ProjectID: &f.project}), "Design login page", "Write API docs", "Ship 100% coverage")
	check(titles(domain.Filter{Sort: "assignee", ProjectID: &f.project}), "Design login page", "Write API docs", "Ship 100% coverage")
	check(titles(domain.Filter{Sort: "project", Desc: true})[:1], "Landing page")

	page2, total, _ := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{Sort: "key"}, pagination.Params{Page: 2, Size: 3})
	if len(page2) != 1 || total != 4 {
		t.Fatalf("pagination: %d items, total %d", len(page2), total)
	}
	beyond, total, _ := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{}, pagination.Params{Page: 9, Size: 3})
	if len(beyond) != 0 || total != 4 {
		t.Fatal("pages past the end still report the total")
	}

	counts, err := f.Cards.Counts(f.ctx, f.owner, f.ws, domain.Filter{ProjectID: &f.project})
	if err != nil || counts[domain.Todo] != 1 || counts[domain.InReview] != 1 || counts[domain.Done] != 1 || counts[domain.InProgress] != 0 {
		t.Fatalf("counts %v %v", counts, err)
	}

	// Archiving the project hides its cards everywhere.
	if err := f.Projects.Archive(f.ctx, f.owner, f.otherProj); err != nil {
		t.Fatal(err)
	}
	check(titles(domain.Filter{Query: "Landing"}))
}

func TestDeleteBulkAndProjectCounters(t *testing.T) {
	f := setup(t)
	a, b, c := f.card(t, "A"), f.card(t, "B"), f.card(t, "C")
	n, err := f.Cards.Bulk(f.ctx, f.member, f.ws, service.BulkAction{IDs: []uuid.UUID{a.ID, b.ID, uuid.New()}, Action: "move", Status: ptr(domain.Done)})
	if err != nil || n != 2 {
		t.Fatalf("bulk move: %d %v", n, err)
	}
	n, _ = f.Cards.Bulk(f.ctx, f.member, f.ws, service.BulkAction{IDs: []uuid.UUID{a.ID, c.ID}, Action: "priority", Priority: ptr(domain.High)})
	if n != 2 {
		t.Fatalf("bulk priority: %d", n)
	}
	p, _ := f.Projects.Get(f.ctx, f.owner, f.project)
	if p.TaskCount != 3 || p.DoneCount != 2 {
		t.Fatalf("counters after bulk move: %d/%d", p.DoneCount, p.TaskCount)
	}
	if err := f.Cards.Delete(f.ctx, f.member, c.ID); err != nil {
		t.Fatal(err)
	}
	_, err = f.Cards.Get(f.ctx, f.member, c.ID)
	mustCode(t, err, domain.ErrNotFound)
	n, _ = f.Cards.Bulk(f.ctx, f.member, f.ws, service.BulkAction{IDs: []uuid.UUID{a.ID}, Action: "delete"})
	p, _ = f.Projects.Get(f.ctx, f.owner, f.project)
	if n != 1 || p.TaskCount != 1 || p.DoneCount != 1 {
		t.Fatalf("counters after delete: %d/%d", p.DoneCount, p.TaskCount)
	}
	_, err = f.Cards.Bulk(f.ctx, f.member, f.ws, service.BulkAction{IDs: []uuid.UUID{b.ID}, Action: "explode"})
	mustCode(t, err, apperr.Validation)
	_, err = f.Cards.Bulk(f.ctx, f.viewer, f.ws, service.BulkAction{IDs: []uuid.UUID{b.ID}, Action: "delete"})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
}

func TestStats(t *testing.T) {
	f := setup(t)
	a := f.card(t, "A")
	f.card(t, "B", func(c *domain.NewCard) { c.Status = domain.InReview })
	if _, err := f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: a.Version, Status: ptr(domain.Done)}); err != nil {
		t.Fatal(err)
	}
	st, err := f.Cards.Stats(f.ctx, f.viewer, f.ws, 7)
	if err != nil {
		t.Fatal(err)
	}
	k := st.KPIs
	if k.Total != 2 || k.Active != 1 || k.InReview != 1 || k.DoneThisWeek != 1 || k.CreatedThisWeek != 2 {
		t.Fatalf("kpis %+v", k)
	}
	if len(st.Daily) != 7 {
		t.Fatalf("daily len %d", len(st.Daily))
	}
	// The KPIs follow the selected period.
	if st14, err := f.Cards.Stats(f.ctx, f.viewer, f.ws, 14); err != nil || st14.KPIs.CreatedThisWeek != 2 || len(st14.Daily) != 14 {
		t.Fatalf("14-day stats: %+v %v", st14.KPIs, err)
	}
	last := st.Daily[6].Counts
	if last[domain.Todo] != 1 || last[domain.InReview] != 1 || last[domain.Done] != 1 {
		t.Fatalf("today's transitions %v", last)
	}
	if len(st.Activity) != 3 || st.Activity[0].To != domain.Done || st.Actors[*st.Activity[0].ActorID].Name != "Maria Member" ||
		st.Projects[st.Activity[0].ProjectID].Key != "KC" {
		t.Fatalf("activity %+v", st.Activity)
	}
}

func TestWorkspaceTaskPolicies(t *testing.T) {
	f := setup(t)
	pr := func(p string) *string { return &p }
	// The default priority is the workspace's, and a due date can be required.
	if _, err := f.Workspaces.UpdateSettings(f.ctx, f.owner, f.ws, wsdomain.SettingsPatch{DefaultPriority: pr("high"), RequireDueDate: ptr(true)}); err != nil {
		t.Fatal(err)
	}
	_, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: "No date"})
	mustCode(t, err, apperr.Validation)
	due := time.Now().AddDate(0, 0, 3)
	c, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: "With date", DueDate: &due})
	if err != nil || c.Priority != domain.High {
		t.Fatalf("default priority: %+v %v", c, err)
	}
	// An explicit priority is kept.
	c, err = f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: "Low", Priority: domain.Low, DueDate: &due})
	if err != nil || c.Priority != domain.Low {
		t.Fatalf("explicit priority: %+v %v", c, err)
	}
}

func TestExportNeedsThePermission(t *testing.T) {
	f := setup(t)
	if _, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: "Exported"}); err != nil {
		t.Fatal(err)
	}
	// Members cannot download everything by default; the owner can.
	_, _, err := f.Cards.Export(f.ctx, f.member, f.ws, domain.Filter{})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	views, truncated, err := f.Cards.Export(f.ctx, f.owner, f.ws, domain.Filter{})
	if err != nil || truncated || len(views) == 0 {
		t.Fatalf("owner export: %d %v %v", len(views), truncated, err)
	}
	// The permission can be given to members.
	perms := append(wsdomain.RoleDefaults(wsdomain.RoleMember), wsdomain.PermExport)
	if err := f.Workspaces.SetRolePermissions(f.ctx, f.owner, f.ws, wsdomain.RoleMember, perms); err != nil {
		t.Fatal(err)
	}
	if _, _, err := f.Cards.Export(f.ctx, f.member, f.ws, domain.Filter{}); err != nil {
		t.Fatalf("member with the permission: %v", err)
	}
}
