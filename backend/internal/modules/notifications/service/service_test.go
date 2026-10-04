package service_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	chatdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	chatservice "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func mention(name string, id uuid.UUID) string { return "@[" + name + "](" + id.String() + ")" }

type world struct {
	e                         *testkit.Env
	ws, project               uuid.UUID
	owner, anna, ben, outside uuid.UUID
}

func setup(t *testing.T) world {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	w := world{e: e}
	w.owner = e.User("Olena Owner", "o@example.com")
	w.anna = e.User("Anna Member", "a@example.com")
	w.ben = e.User("Ben Member", "b@example.com")
	w.outside = e.User("Out Sider", "x@example.com")
	w.ws = e.Workspace(w.owner, map[uuid.UUID]wsdomain.Role{w.anna: wsdomain.RoleMember, w.ben: wsdomain.RoleMember}, tdb.Pool)
	w.project = e.Project(w.owner, w.ws, "Core")
	return w
}

func kinds(t *testing.T, w world, user uuid.UUID) []domain.Kind {
	t.Helper()
	p, err := w.e.Notices.List(context.Background(), user, w.ws, nil, 50)
	if err != nil {
		t.Fatal(err)
	}
	out := make([]domain.Kind, len(p.Items))
	for i, n := range p.Items {
		out[len(p.Items)-1-i] = n.Kind // oldest first
	}
	return out
}

func equal(a, b []domain.Kind) bool {
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

func TestTaskNotifications(t *testing.T) {
	w := setup(t)
	ctx := context.Background()

	// Created with Anna on it: she is told, the author is not.
	card, err := w.e.Cards.Create(ctx, w.ben, w.ws, carddomain.NewCard{ProjectID: w.project, Title: "Fix login", AssigneeIDs: []uuid.UUID{w.anna}})
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(t, w, w.anna); !equal(got, []domain.Kind{domain.Assigned}) {
		t.Fatalf("anna after create: %v", got)
	}
	if got := kinds(t, w, w.ben); len(got) != 0 {
		t.Fatalf("author must not be told of their own action: %v", got)
	}

	// Ben moves and edits it, then adds himself and comments: Anna hears of each; Ben of none.
	done := carddomain.Done
	cur, _ := w.e.Cards.Get(ctx, w.ben, card.ID)
	moved, err := w.e.Cards.Move(ctx, w.ben, card.ID, carddomain.Move{Version: cur.Version, Status: &done})
	if err != nil {
		t.Fatal(err)
	}
	high := carddomain.High
	edited, err := w.e.Cards.Update(ctx, w.ben, card.ID, carddomain.Patch{Version: moved.Version, Priority: &high})
	if err != nil {
		t.Fatal(err)
	}
	// Putting Ben's colleague Olena on it: she hears "assigned", Anna "updated".
	if _, err := w.e.Cards.Update(ctx, w.ben, card.ID, carddomain.Patch{Version: edited.Version, AssigneeIDs: &[]uuid.UUID{w.anna, w.owner}}); err != nil {
		t.Fatal(err)
	}
	if got := kinds(t, w, w.owner); !equal(got, []domain.Kind{domain.Assigned}) {
		t.Fatalf("owner: %v", got)
	}
	if _, err := w.e.Comments.Create(ctx, w.ben, card.ID, "Looks good"); err != nil {
		t.Fatal(err)
	}
	want := []domain.Kind{domain.Assigned, domain.TaskMoved, domain.TaskUpdated, domain.TaskCommented}
	if got := kinds(t, w, w.anna); !equal(got, want) {
		t.Fatalf("anna: %v, want %v", got, want)
	}
	page, _ := w.e.Notices.List(ctx, w.anna, w.ws, nil, 50)
	if page.Unread != 4 || page.Items[0].Actor == nil || page.Items[0].Actor.ID != w.ben {
		t.Fatalf("page: unread=%d first=%+v", page.Unread, page.Items[0])
	}
	if page.Items[0].Title == "" || page.Items[0].CardID == nil {
		t.Fatalf("subject missing: %+v", page.Items[0])
	}

	// Read state is per person.
	if err := w.e.Notices.MarkRead(ctx, w.anna, w.ws, []uuid.UUID{page.Items[0].ID}, false); err != nil {
		t.Fatal(err)
	}
	after, _ := w.e.Notices.List(ctx, w.anna, w.ws, nil, 50)
	if after.Unread != 3 || !after.Items[0].Read() {
		t.Fatalf("after one read: %d", after.Unread)
	}
	if err := w.e.Notices.MarkRead(ctx, w.anna, w.ws, nil, true); err != nil {
		t.Fatal(err)
	}
	if after, _ = w.e.Notices.List(ctx, w.anna, w.ws, nil, 50); after.Unread != 0 {
		t.Fatalf("after all read: %d", after.Unread)
	}
	if other, _ := w.e.Notices.List(ctx, w.owner, w.ws, nil, 50); other.Unread != 2 { // assigned, then the comment
		t.Fatalf("someone else's read state changed: %d", other.Unread)
	}

	// Strangers cannot read a workspace's notifications.
	_, err = w.e.Notices.List(ctx, w.outside, w.ws, nil, 50)
	if !apperr.IsCode(err, wsdomain.ErrNotFound) && !apperr.IsCode(err, wsdomain.ErrInsufficientRole) {
		t.Fatalf("outsider: %v", err)
	}
}

func TestChatNotifications(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.e.Chat

	general, err := w.e.Chat.CreateChannel(ctx, w.ben, w.ws, chatservice.ChannelInput{Name: "general"})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = c.Join(ctx, w.anna, general.ID)
	_, _ = c.Join(ctx, w.owner, general.ID)

	// A plain message rings nobody; a mention rings the one named; @channel rings everyone else.
	post := func(body string) {
		t.Helper()
		if _, err := c.Post(ctx, w.ben, general.ID, nil, body, nil); err != nil {
			t.Fatal(err)
		}
	}
	post("hello team")
	post("ping " + mention("Anna Member", w.anna))
	post("@channel standup")
	if got := kinds(t, w, w.anna); !equal(got, []domain.Kind{domain.Mention, domain.Mention}) {
		t.Fatalf("anna: %v", got)
	}
	if got := kinds(t, w, w.owner); !equal(got, []domain.Kind{domain.Mention}) {
		t.Fatalf("owner: %v", got)
	}
	if got := kinds(t, w, w.ben); len(got) != 0 {
		t.Fatalf("author: %v", got)
	}

	// Muting stops @channel, not a direct mention.
	_ = c.SetNotify(ctx, w.owner, general.ID, "muted", nil)
	post("@channel again")
	post(mention("Olena Owner", w.owner) + " you there?")
	if got := kinds(t, w, w.owner); !equal(got, []domain.Kind{domain.Mention, domain.Mention}) {
		t.Fatalf("owner after mute: %v", got)
	}

	// A direct message rings the other person.
	dm, err := c.OpenDM(ctx, w.ben, w.ws, []uuid.UUID{w.anna})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Post(ctx, w.ben, dm.ID, nil, "got a minute?", nil); err != nil {
		t.Fatal(err)
	}
	got := kinds(t, w, w.anna)
	if got[len(got)-1] != domain.DM {
		t.Fatalf("dm: %v", got)
	}

	// The conversation of a task reaches the people on it.
	card, err := w.e.Cards.Create(ctx, w.ben, w.ws, carddomain.NewCard{ProjectID: w.project, Title: "Fix login", AssigneeIDs: []uuid.UUID{w.anna}})
	if err != nil {
		t.Fatal(err)
	}
	scope, err := c.ScopeChannel(ctx, w.ben, chatdomain.Card, card.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Post(ctx, w.ben, scope.ID, nil, "see the attached log", nil); err != nil {
		t.Fatal(err)
	}
	got = kinds(t, w, w.anna)
	if got[len(got)-1] != domain.TaskCommented {
		t.Fatalf("card chat: %v", got)
	}
}
