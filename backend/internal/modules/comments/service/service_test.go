package service_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
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

func mention(name string, id uuid.UUID) string { return "@[" + name + "](" + id.String() + ")" }

func TestCommentsLifecycle(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Olena Owner", "o@example.com")
	member := e.User("Maria Member", "m@example.com")
	viewer := e.User("Vira Viewer", "v@example.com")
	stranger := e.User("Stranger", "s@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, viewer: wsdomain.RoleViewer}, tdb.Pool)
	card := e.Card(member, ws, e.Project(owner, ws, "Core"), "Discuss")

	body := "Hi " + mention("Olena", owner) + " and " + mention("Nobody", stranger) + " ✨"
	c, err := e.Comments.Create(ctx, member, card.ID, "  "+body+"  ")
	if err != nil {
		t.Fatal(err)
	}
	if c.Body != body || c.Author == nil || c.Author.ID != member {
		t.Fatalf("created %+v", c)
	}
	if len(c.Mentioned) != 1 || c.Mentioned[0].ID != owner {
		t.Fatalf("only workspace members are mentioned: %+v", c.Mentioned)
	}
	got, _ := e.Cards.Get(ctx, owner, card.ID)
	if got.CommentCount != 1 {
		t.Fatalf("card comment counter = %d", got.CommentCount)
	}

	_, err = e.Comments.Create(ctx, viewer, card.ID, "read only")
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = e.Comments.Create(ctx, member, card.ID, strings.Repeat("x", domain.MaxBodyLen+1))
	mustCode(t, err, apperr.Validation)
	_, err = e.Comments.List(ctx, stranger, card.ID)
	mustCode(t, err, carddomain.ErrNotFound)

	_, err = e.Comments.Update(ctx, owner, c.ID, "not yours")
	mustCode(t, err, domain.ErrForbidden)
	edited, err := e.Comments.Update(ctx, member, c.ID, "Edited for "+mention("Vira", viewer))
	if err != nil || edited.EditedAt == nil || len(edited.Mentioned) != 1 || edited.Mentioned[0].ID != viewer {
		t.Fatalf("edit: %+v %v", edited, err)
	}

	second, _ := e.Comments.Create(ctx, member, card.ID, "second")
	list, err := e.Comments.List(ctx, viewer, card.ID)
	if err != nil || len(list) != 2 || list[0].ID != c.ID {
		t.Fatalf("list oldest first: %d %v", len(list), err)
	}
	mustCode(t, e.Comments.Delete(ctx, viewer, second.ID), domain.ErrForbidden)
	if err := e.Comments.Delete(ctx, owner, second.ID); err != nil { // admins may delete any comment
		t.Fatal(err)
	}
	if err := e.Comments.Delete(ctx, member, c.ID); err != nil { // authors may delete their own
		t.Fatal(err)
	}
	got, _ = e.Cards.Get(ctx, owner, card.ID)
	if got.CommentCount != 0 {
		t.Fatalf("counter after deletes = %d", got.CommentCount)
	}
	feed, _, _ := e.Activity.CardFeed(ctx, owner, card.ID, nil, 0)
	kinds := map[string]int{}
	for _, f := range feed {
		kinds[f.Kind]++
	}
	if kinds["comment.created"] != 2 || kinds["comment.deleted"] != 2 {
		t.Fatalf("activity %v", kinds)
	}
}
