package service_test

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/service"
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

type fixture struct {
	e                          *testkit.Env
	svc                        *service.Service
	ws, project                uuid.UUID
	owner, member, viewer, out uuid.UUID
}

func setup(t *testing.T) fixture {
	t.Helper()
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	owner := e.User("Olena Owner", "o@example.com")
	member := e.User("Maria Member", "m@example.com")
	viewer := e.User("Vira Viewer", "v@example.com")
	out := e.User("Stranger", "s@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, viewer: wsdomain.RoleViewer}, tdb.Pool)
	project := e.Project(owner, ws, "Reports")
	svc := service.New(repository.New(tdb.Pool), e.Cards, e.Workspaces, e.Projects, slog.Default())
	return fixture{e: e, svc: svc, ws: ws, project: project, owner: owner, member: member, viewer: viewer, out: out}
}

func days(n int) *int { return &n }

func TestTemplatesAreValidatedUniqueAndGuarded(t *testing.T) {
	f := setup(t)
	ctx := context.Background()

	got, err := f.svc.CreateTemplate(ctx, f.member, f.ws, service.TemplateInput{Name: "  Weekly report ", Title: " Report ",
		Checklist: []string{" collect ", "", "write"}, Subtasks: []string{"draft"}, DueInDays: days(3)})
	if err != nil || got.Name != "Weekly report" || got.Title != "Report" || len(got.Checklist) != 2 || got.Priority != "medium" {
		t.Fatalf("create: %+v %v", got, err)
	}

	// Names are unique per workspace, ignoring case.
	_, err = f.svc.CreateTemplate(ctx, f.owner, f.ws, service.TemplateInput{Name: "weekly REPORT", Title: "x"})
	mustCode(t, err, domain.ErrNameTaken)

	for name, in := range map[string]service.TemplateInput{
		"no name":     {Title: "x"},
		"no title":    {Name: "a"},
		"bad due":     {Name: "b", Title: "x", DueInDays: days(366)},
		"bad urgency": {Name: "c", Title: "x", Priority: "urgent"},
	} {
		if _, err := f.svc.CreateTemplate(ctx, f.owner, f.ws, in); !apperr.IsCode(err, apperr.Validation) {
			t.Fatalf("%s: want a validation error, got %v", name, err)
		}
	}

	// Only people who may edit content write; a viewer reads; a stranger sees nothing.
	_, err = f.svc.CreateTemplate(ctx, f.viewer, f.ws, service.TemplateInput{Name: "v", Title: "x"})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	if list, err := f.svc.Templates(ctx, f.viewer, f.ws); err != nil || len(list) != 1 {
		t.Fatalf("viewer list: %v %v", list, err)
	}
	_, err = f.svc.Templates(ctx, f.out, f.ws)
	mustCode(t, err, wsdomain.ErrNotFound)
	_, err = f.svc.UpdateTemplate(ctx, f.viewer, got.ID, service.TemplateInput{Name: "x", Title: "y"})
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	up, err := f.svc.UpdateTemplate(ctx, f.owner, got.ID, service.TemplateInput{Name: "Weekly report", Title: "Report v2", DueInDays: nil})
	if err != nil || up.Title != "Report v2" || up.DueInDays != nil || len(up.Checklist) != 0 {
		t.Fatalf("update: %+v %v", up, err)
	}
}

func TestUseMakesTheTaskWithItsChecklistAndSubtasks(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	tpl, err := f.svc.CreateTemplate(ctx, f.owner, f.ws, service.TemplateInput{Name: "Release", Title: "Release", Description: "Ship it",
		Priority: "high", Checklist: []string{"tests", "tag"}, Subtasks: []string{"notes", "announce"}, DueInDays: days(2),
		// A person who is not in the workspace is left out instead of failing the task.
		AssigneeIDs: []uuid.UUID{f.member, f.out}})
	if err != nil {
		t.Fatal(err)
	}

	card, err := f.svc.Use(ctx, f.member, tpl.ID, service.UseInput{ProjectID: f.project})
	if err != nil || card.Title != "Release" || card.Priority != carddomain.Priority("high") || card.DueDate == nil {
		t.Fatalf("use: %+v %v", card, err)
	}
	want := time.Now().UTC().AddDate(0, 0, 2)
	if card.DueDate.Format("2006-01-02") != want.Format("2006-01-02") {
		t.Fatalf("due %v, want 2 days from today (%v)", card.DueDate, want)
	}
	if len(card.Assignees) != 1 || card.Assignees[0].ID != f.member {
		t.Fatalf("assignees: %+v", card.Assignees)
	}
	items, err := f.e.Cards.Checklist(ctx, f.owner, card.ID)
	if err != nil || len(items) != 2 || items[0].Text != "tests" {
		t.Fatalf("checklist: %+v %v", items, err)
	}
	subs, _, err := f.e.Cards.List(ctx, f.owner, f.ws, carddomain.Filter{ParentID: &card.ID}, pagination.Params{Page: 1, Size: 20})
	if err != nil || len(subs) != 2 {
		t.Fatalf("subtasks: %d %v", len(subs), err)
	}

	// The person may rename it and pick the day.
	title, due := "Release 2", time.Date(2030, 1, 2, 0, 0, 0, 0, time.UTC)
	over, err := f.svc.Use(ctx, f.owner, tpl.ID, service.UseInput{ProjectID: f.project, Title: &title, DueDate: &due})
	if err != nil || over.Title != "Release 2" || over.DueDate.Format("2006-01-02") != "2030-01-02" {
		t.Fatalf("overrides: %+v %v", over, err)
	}

	_, err = f.svc.Use(ctx, f.viewer, tpl.ID, service.UseInput{ProjectID: f.project})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
}

func TestSchedulesRunDueAndFollowTheirTemplate(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	tpl, err := f.svc.CreateTemplate(ctx, f.owner, f.ws, service.TemplateInput{Name: "Standup notes", Title: "Standup notes", Checklist: []string{"blockers"}})
	if err != nil {
		t.Fatal(err)
	}

	_, err = f.svc.CreateRecurring(ctx, f.owner, f.ws, service.RecurrenceInput{TemplateID: tpl.ID, ProjectID: f.project, Freq: domain.Weekly, Hour: 9, Active: true})
	if !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("a weekly schedule needs days: %v", err)
	}
	_, err = f.svc.CreateRecurring(ctx, f.owner, f.ws, service.RecurrenceInput{TemplateID: tpl.ID, ProjectID: f.project, Freq: domain.Daily, Hour: 24, Active: true})
	if !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("hour 24 is not an hour: %v", err)
	}

	r, err := f.svc.CreateRecurring(ctx, f.owner, f.ws, service.RecurrenceInput{TemplateID: tpl.ID, ProjectID: f.project, Freq: domain.Daily,
		Hour: 9, Timezone: "Europe/Kyiv", Active: true})
	if err != nil || !r.NextRunAt.After(time.Now()) || r.Timezone != "Europe/Kyiv" {
		t.Fatalf("create: %+v %v", r, err)
	}
	_, err = f.svc.CreateRecurring(ctx, f.owner, f.ws, service.RecurrenceInput{TemplateID: tpl.ID, ProjectID: f.project, Freq: domain.Daily, Hour: 9, Timezone: "Mars/Base"})
	if !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("an unknown zone is refused: %v", err)
	}
	_, err = f.svc.CreateRecurring(ctx, f.viewer, f.ws, service.RecurrenceInput{TemplateID: tpl.ID, ProjectID: f.project, Freq: domain.Daily, Hour: 9})
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	// Nothing is due yet; once the time comes the task appears and the schedule moves on a day.
	f.svc.Tick(ctx)
	if got, _ := f.svc.Recurring(ctx, f.owner, f.ws); got[0].LastRunAt != nil {
		t.Fatalf("ran too early: %+v", got[0])
	}
	if _, err := tdb.Pool.Exec(ctx, `UPDATE recurring_tasks SET next_run_at = now() - interval '1 minute' WHERE id = $1`, r.ID); err != nil {
		t.Fatal(err)
	}
	f.svc.Tick(ctx)
	got, err := f.svc.Recurring(ctx, f.owner, f.ws)
	if err != nil || got[0].LastCardID == nil || got[0].LastRunAt == nil || !got[0].NextRunAt.After(time.Now()) || got[0].LastError != nil {
		t.Fatalf("after the run: %+v %v", got, err)
	}
	card, err := f.e.Cards.Get(ctx, f.owner, *got[0].LastCardID)
	if err != nil || card.Title != "Standup notes" || card.ProjectID != f.project {
		t.Fatalf("the task: %+v %v", card, err)
	}
	// A second tick must not repeat it.
	f.svc.Tick(ctx)
	if again, _ := f.svc.Recurring(ctx, f.owner, f.ws); *again[0].LastCardID != card.ID {
		t.Fatalf("ran twice: %+v", again[0])
	}

	// When the person who set it up can no longer make tasks there, the schedule switches itself off.
	if _, err := tdb.Pool.Exec(ctx, `UPDATE recurring_tasks SET next_run_at = now() - interval '1 minute', created_by = $2 WHERE id = $1`, r.ID, f.out); err != nil {
		t.Fatal(err)
	}
	f.svc.Tick(ctx)
	got, _ = f.svc.Recurring(ctx, f.owner, f.ws)
	if got[0].Active || got[0].LastError == nil {
		t.Fatalf("should be switched off with a reason: %+v", got[0])
	}

	// Deleting a template takes its schedules with it.
	if err := f.svc.DeleteTemplate(ctx, f.owner, tpl.ID); err != nil {
		t.Fatal(err)
	}
	if left, _ := f.svc.Recurring(ctx, f.owner, f.ws); len(left) != 0 {
		t.Fatalf("schedules left: %+v", left)
	}
	_, err = f.svc.Use(ctx, f.owner, tpl.ID, service.UseInput{ProjectID: f.project})
	mustCode(t, err, domain.ErrNotFound)
}
