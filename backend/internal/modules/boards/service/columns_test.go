package service_test

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

func names(t *testing.T, e *testkit.Env, user, project uuid.UUID) []string {
	t.Helper()
	b, err := e.Boards.Board(context.Background(), user, project)
	if err != nil {
		t.Fatal(err)
	}
	out := make([]string, len(b.Columns))
	for i, c := range b.Columns {
		out[i] = c.Name
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

func TestCustomColumns(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	viewer := e.User("Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{viewer: wsdomain.RoleViewer}, tdb.Pool)
	p := e.Project(owner, ws, "Core")

	wip := 3
	qa, err := e.Boards.CreateColumn(ctx, owner, p, service.NewColumn{Name: " QA ", Category: domain.InReview, WIPLimit: &wip})
	if err != nil || qa.Name != "QA" || qa.WIPLimit == nil || *qa.WIPLimit != 3 {
		t.Fatalf("create: %+v %v", qa, err)
	}
	if got := names(t, e, owner, p); !equal(got, []string{"To Do", "In Progress", "In Review", "QA", "Completed"}) {
		t.Fatalf("placed after the status' last column: %v", got)
	}
	_, err = e.Boards.CreateColumn(ctx, owner, p, service.NewColumn{Name: "X", Category: "blocked"})
	mustCode(t, err, apperr.Validation)
	_, err = e.Boards.CreateColumn(ctx, viewer, p, service.NewColumn{Name: "X", Category: domain.Todo})
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	// Rename + clear WIP limit.
	renamed, err := e.Boards.UpdateColumn(ctx, owner, qa.ID, repository.ColumnPatch{Name: ptr("Testing"), SetWIP: true})
	if err != nil || renamed.Name != "Testing" || renamed.WIPLimit != nil {
		t.Fatalf("update: %+v %v", renamed, err)
	}
	bad := 0
	_, err = e.Boards.UpdateColumn(ctx, owner, qa.ID, repository.ColumnPatch{SetWIP: true, WIP: &bad})
	mustCode(t, err, apperr.Validation)

	// Reorder: Testing to the front.
	b, _ := e.Boards.Board(ctx, owner, p)
	if _, err := e.Boards.MoveColumn(ctx, owner, qa.ID, nil, &b.Columns[0].ID); err != nil {
		t.Fatal(err)
	}
	if got := names(t, e, owner, p); got[0] != "Testing" {
		t.Fatalf("after move %v", got)
	}

	// Delete rules: non-empty → conflict; last column of a status → refused; empty extra → ok.
	card, err := e.Cards.Create(ctx, owner, ws, carddomain.NewCard{ProjectID: p, Title: "In QA", ColumnID: &qa.ID})
	if err != nil || card.Status != carddomain.InReview {
		t.Fatalf("card in custom column: %+v %v", card.Card, err)
	}
	mustCode(t, e.Boards.DeleteColumn(ctx, owner, qa.ID), domain.ErrColumnNotEmpty)
	todo, _ := e.Boards.FirstColumn(ctx, p, domain.Todo)
	mustCode(t, e.Boards.DeleteColumn(ctx, owner, todo.ID), domain.ErrLastColumnOfStatus)
	if err := e.Cards.Delete(ctx, owner, card.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.Boards.DeleteColumn(ctx, owner, qa.ID); err != nil {
		t.Fatal(err)
	}

	// At most MaxColumns.
	for i := 4; i < domain.MaxColumns; i++ {
		if _, err := e.Boards.CreateColumn(ctx, owner, p, service.NewColumn{Name: "Extra", Category: domain.InProgress}); err != nil {
			t.Fatal(err)
		}
	}
	_, err = e.Boards.CreateColumn(ctx, owner, p, service.NewColumn{Name: "One too many", Category: domain.Todo})
	mustCode(t, err, domain.ErrTooManyColumns)
}

func TestSavedViews(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	viewer := e.User("Viewer", "v@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{viewer: wsdomain.RoleViewer}, tdb.Pool)

	cfg := json.RawMessage(`{"swimlane":"assignee","filters":{"priority":"high"}}`)
	v, err := e.Boards.CreateView(ctx, viewer, ws, " My high ", cfg) // viewers may save personal views
	if err != nil || v.Name != "My high" {
		t.Fatalf("create: %+v %v", v, err)
	}
	_, err = e.Boards.CreateView(ctx, viewer, ws, "Bad", json.RawMessage(`[1,2]`))
	mustCode(t, err, apperr.Validation)

	mine, _ := e.Boards.Views(ctx, viewer, ws)
	theirs, _ := e.Boards.Views(ctx, owner, ws)
	if len(mine) != 1 || len(theirs) != 0 {
		t.Fatalf("views are personal: %d / %d", len(mine), len(theirs))
	}
	_, err = e.Boards.UpdateView(ctx, owner, v.ID, ptr("hijack"), nil)
	mustCode(t, err, domain.ErrViewNotFound)
	upd, err := e.Boards.UpdateView(ctx, viewer, v.ID, nil, json.RawMessage(`{"swimlane":"none"}`))
	if err != nil || upd.Name != "My high" || string(upd.Config) == string(cfg) {
		t.Fatalf("update: %+v %v", upd, err)
	}
	mustCode(t, e.Boards.DeleteView(ctx, owner, v.ID), domain.ErrViewNotFound)
	if err := e.Boards.DeleteView(ctx, viewer, v.ID); err != nil {
		t.Fatal(err)
	}
}

func ptr[T any](v T) *T { return &v }
