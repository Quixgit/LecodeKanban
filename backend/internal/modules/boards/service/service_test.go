package service_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	projectsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func TestDefaultBoard(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Owner", "o@example.com")
	stranger := e.User("Stranger", "s@example.com")
	ws := e.Workspace(owner, nil, tdb.Pool)
	p, err := e.Projects.Create(ctx, owner, ws, projectsvc.CreateInput{Name: "Core"}, "fr") // unknown locale → English names
	if err != nil {
		t.Fatal(err)
	}

	// Idempotent: a second call must not add columns.
	if err := e.Boards.EnsureDefault(ctx, ws, p.ID, "Core", "uk"); err != nil {
		t.Fatal(err)
	}
	b, err := e.Boards.Board(ctx, owner, p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Columns) != 4 || b.Columns[0].Name != "To Do" || b.Columns[2].Category != domain.InReview {
		t.Fatalf("columns %+v", b.Columns)
	}
	for i := 1; i < len(b.Columns); i++ {
		if b.Columns[i-1].Position >= b.Columns[i].Position {
			t.Fatal("columns must be ordered by position")
		}
	}

	col, err := e.Boards.Column(ctx, b.Columns[1].ID)
	if err != nil || col.ProjectID != p.ID || col.WorkspaceID != ws || col.Category != domain.InProgress {
		t.Fatalf("column lookup %+v %v", col, err)
	}
	first, err := e.Boards.FirstColumn(ctx, p.ID, domain.Done)
	if err != nil || first.ID != b.Columns[3].ID {
		t.Fatalf("first done column %+v %v", first, err)
	}

	if _, err := e.Boards.Board(ctx, stranger, p.ID); !apperr.IsCode(err, wsdomain.ErrNotFound) {
		t.Fatalf("strangers must not see boards: %v", err)
	}
	if _, err := e.Boards.Board(ctx, owner, uuid.New()); !apperr.IsCode(err, domain.ErrBoardNotFound) {
		t.Fatalf("unknown project: %v", err)
	}
	if _, err := e.Boards.Column(ctx, uuid.New()); !apperr.IsCode(err, domain.ErrColumnNotFound) {
		t.Fatalf("unknown column: %v", err)
	}
	if !domain.Done.Valid() || domain.Category("blocked").Valid() {
		t.Fatal("category validation")
	}
}
