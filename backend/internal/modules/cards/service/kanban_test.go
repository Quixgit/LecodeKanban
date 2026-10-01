package service_test

import (
	"slices"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func TestDeriveProgress(t *testing.T) {
	cases := []struct {
		status      domain.Status
		total, done int
		want        int
	}{
		{domain.Todo, 0, 0, 0},
		{domain.InProgress, 0, 0, 40},
		{domain.InReview, 0, 0, 80},
		{domain.Done, 0, 0, 100},
		{domain.Todo, 4, 1, 25},
		{domain.InProgress, 3, 3, 99}, // all checked but not done: never 100
		{domain.Done, 4, 0, 100},
	}
	for _, c := range cases {
		if got := domain.DeriveProgress(c.status, c.total, c.done); got != c.want {
			t.Errorf("DeriveProgress(%s,%d,%d) = %d, want %d", c.status, c.total, c.done, got, c.want)
		}
	}
}

func TestChecklistDrivesProgress(t *testing.T) {
	f := setup(t)
	c := f.card(t, "Ship it")
	progress := func() int {
		t.Helper()
		v, err := f.Cards.Get(f.ctx, f.owner, c.ID)
		if err != nil {
			t.Fatal(err)
		}
		return v.Progress
	}
	items := make([]domain.ChecklistItem, 4)
	for i, text := range []string{"one", "two", "three", "four"} {
		it, err := f.Cards.AddChecklistItem(f.ctx, f.member, c.ID, "  "+text+" ")
		if err != nil || it.Text != text {
			t.Fatalf("add: %+v %v", it, err)
		}
		items[i] = it
	}
	done := true
	for _, it := range items[:2] {
		if _, err := f.Cards.UpdateChecklistItem(f.ctx, f.member, it.ID, service.ItemPatch{Done: &done}); err != nil {
			t.Fatal(err)
		}
	}
	if p := progress(); p != 50 {
		t.Fatalf("2/4 checked = %d%%", p)
	}
	cur, _ := f.Cards.Get(f.ctx, f.owner, c.ID)
	moved, err := f.Cards.Move(f.ctx, f.member, c.ID, domain.Move{Version: cur.Version, Status: ptr(domain.InReview)})
	if err != nil || moved.Progress != 50 {
		t.Fatalf("checklist wins over stage: %d %v", moved.Progress, err)
	}
	for _, it := range items[2:] {
		if _, err := f.Cards.UpdateChecklistItem(f.ctx, f.member, it.ID, service.ItemPatch{Done: &done}); err != nil {
			t.Fatal(err)
		}
	}
	if p := progress(); p != 99 {
		t.Fatalf("all checked, not done = %d%%", p)
	}
	for _, it := range items {
		if err := f.Cards.DeleteChecklistItem(f.ctx, f.member, it.ID); err != nil {
			t.Fatal(err)
		}
	}
	if p := progress(); p != 80 {
		t.Fatalf("empty checklist falls back to the stage (review) = %d%%", p)
	}
	// Project progress is the average of its cards: this card (80) + a fresh to-do (0).
	f.card(t, "Next")
	p, err := f.Projects.Get(f.ctx, f.owner, f.project)
	if err != nil || p.Progress() != 40 {
		t.Fatalf("project progress = %d (%v)", p.Progress(), err)
	}
}

func TestChecklistOrderingAndAccess(t *testing.T) {
	f := setup(t)
	c := f.card(t, "List")
	var ids []uuid.UUID
	for _, text := range []string{"a", "b", "c"} {
		it, err := f.Cards.AddChecklistItem(f.ctx, f.member, c.ID, text)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, it.ID)
	}
	// Move "c" to the top.
	if _, err := f.Cards.UpdateChecklistItem(f.ctx, f.member, ids[2], service.ItemPatch{Move: true, BeforeID: &ids[0]}); err != nil {
		t.Fatal(err)
	}
	items, err := f.Cards.Checklist(f.ctx, f.viewer, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	got := []string{}
	for _, it := range items {
		got = append(got, it.Text)
	}
	if !slices.Equal(got, []string{"c", "a", "b"}) {
		t.Fatalf("order %v", got)
	}

	_, err = f.Cards.AddChecklistItem(f.ctx, f.viewer, c.ID, "nope")
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	_, err = f.Cards.AddChecklistItem(f.ctx, f.member, c.ID, "   ")
	mustCode(t, err, apperr.Validation)
	stranger := f.User("Stranger", "s@example.com")
	_, err = f.Cards.UpdateChecklistItem(f.ctx, stranger, ids[0], service.ItemPatch{Text: ptr("x")})
	mustCode(t, err, domain.ErrItemNotFound)
	other := f.card(t, "Other")
	otherItem, _ := f.Cards.AddChecklistItem(f.ctx, f.member, other.ID, "x")
	_, err = f.Cards.UpdateChecklistItem(f.ctx, f.member, ids[0], service.ItemPatch{Move: true, AfterID: &otherItem.ID})
	mustCode(t, err, domain.ErrInvalidMove)
}

func TestLabels(t *testing.T) {
	f := setup(t)
	bug, err := f.Cards.CreateLabel(f.ctx, f.member, f.ws, " Bug ", "red")
	if err != nil || bug.Name != "Bug" || bug.Tone != "red" {
		t.Fatalf("create: %+v %v", bug, err)
	}
	ui, _ := f.Cards.CreateLabel(f.ctx, f.member, f.ws, "UI", "")
	if ui.Tone != "teal" {
		t.Fatalf("default tone %q", ui.Tone)
	}
	_, err = f.Cards.CreateLabel(f.ctx, f.member, f.ws, "bug", "teal")
	mustCode(t, err, domain.ErrLabelExists)
	_, err = f.Cards.CreateLabel(f.ctx, f.member, f.ws, "X", "pink")
	mustCode(t, err, apperr.Validation)
	_, err = f.Cards.CreateLabel(f.ctx, f.viewer, f.ws, "X", "teal")
	mustCode(t, err, wsdomain.ErrInsufficientRole)

	a := f.card(t, "Crash on start", func(c *domain.NewCard) { c.LabelIDs = []uuid.UUID{bug.ID, ui.ID, bug.ID} })
	f.card(t, "Plain")
	if len(a.LabelList) != 2 || a.LabelList[0].Name != "Bug" {
		t.Fatalf("labels de-duplicated and sorted by name: %+v", a.LabelList)
	}
	board, _, err := f.Cards.Board(f.ctx, f.viewer, f.ws, domain.Filter{LabelID: &bug.ID})
	if err != nil || len(board) != 1 || board[0].ID != a.ID {
		t.Fatalf("label filter: %d cards %v", len(board), err)
	}

	renamed, err := f.Cards.UpdateLabel(f.ctx, f.owner, bug.ID, ptr("Defect"), nil)
	if err != nil || renamed.Name != "Defect" || renamed.Tone != "red" {
		t.Fatalf("rename: %+v %v", renamed, err)
	}
	if err := f.Cards.DeleteLabel(f.ctx, f.owner, bug.ID); err != nil {
		t.Fatal(err)
	}
	after, _ := f.Cards.Get(f.ctx, f.owner, a.ID)
	if len(after.LabelList) != 1 || after.LabelList[0].ID != ui.ID {
		t.Fatalf("deleted label removed from cards: %+v", after.LabelList)
	}
	stranger := f.User("Stranger", "s@example.com")
	_, err = f.Cards.UpdateLabel(f.ctx, stranger, ui.ID, ptr("x"), nil)
	mustCode(t, err, domain.ErrLabelNotFound)
}

func TestLaneMoveAcrossProjects(t *testing.T) {
	f := setup(t)
	a1 := f.card(t, "A1")
	b1 := f.card(t, "B1", func(c *domain.NewCard) { c.ProjectID = f.otherProj })
	b2 := f.card(t, "B2", func(c *domain.NewCard) { c.ProjectID = f.otherProj })
	lane := func() []string {
		t.Helper()
		views, _, err := f.Cards.Board(f.ctx, f.owner, f.ws, domain.Filter{})
		if err != nil {
			t.Fatal(err)
		}
		out := []string{}
		for _, v := range views {
			if v.Status == domain.Todo {
				out = append(out, v.Title)
			}
		}
		return out
	}
	if got := lane(); !slices.Equal(got, []string{"A1", "B1", "B2"}) {
		t.Fatalf("initial lane %v", got)
	}
	// Status-only move: neighbours from another project are fine on the cross-project board.
	if _, err := f.Cards.Move(f.ctx, f.member, a1.ID, domain.Move{Version: a1.Version, Status: ptr(domain.Todo),
		AfterID: &b1.ID, BeforeID: &b2.ID}); err != nil {
		t.Fatal(err)
	}
	if got := lane(); !slices.Equal(got, []string{"B1", "A1", "B2"}) {
		t.Fatalf("after lane move %v", got)
	}
	// Into another status lane, after a card of the other project.
	cur, _ := f.Cards.Get(f.ctx, f.owner, b2.ID)
	ip, err := f.Cards.Move(f.ctx, f.member, b2.ID, domain.Move{Version: cur.Version, Status: ptr(domain.InProgress)})
	if err != nil || ip.Progress != 40 {
		t.Fatalf("to in progress: %+v %v", ip.Card, err)
	}
	cur, _ = f.Cards.Get(f.ctx, f.owner, a1.ID)
	moved, err := f.Cards.Move(f.ctx, f.member, a1.ID, domain.Move{Version: cur.Version, Status: ptr(domain.InProgress), BeforeID: &b2.ID})
	if err != nil || moved.ProjectID != f.project || moved.Position >= ip.Position {
		t.Fatalf("lane insert before other project's card: %+v %v", moved.Card, err)
	}
	// A neighbour of a different status is rejected.
	cur, _ = f.Cards.Get(f.ctx, f.owner, a1.ID)
	_, err = f.Cards.Move(f.ctx, f.member, a1.ID, domain.Move{Version: cur.Version, Status: ptr(domain.InProgress), AfterID: &b1.ID})
	mustCode(t, err, domain.ErrInvalidMove)
}

func TestEventsFeedActivityAndRealtime(t *testing.T) {
	f := setup(t)
	f.Hints.Types()
	c := f.card(t, "Watch me")
	label, _ := f.Cards.CreateLabel(f.ctx, f.member, f.ws, "Docs", "neutral")
	u, err := f.Cards.Update(f.ctx, f.member, c.ID, domain.Patch{Version: c.Version, Priority: ptr(domain.High),
		LabelIDs: &[]uuid.UUID{label.ID}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Cards.Move(f.ctx, f.member, c.ID, domain.Move{Version: u.Version, Status: ptr(domain.Done)}); err != nil {
		t.Fatal(err)
	}
	if got := f.Hints.Types(); !slices.Equal(got, []string{"card.created", "labels.changed", "card.updated", "card.moved"}) {
		t.Fatalf("realtime hints %v", got)
	}
	feed, more, err := f.Activity.CardFeed(f.ctx, f.viewer, c.ID, nil, 0)
	if err != nil || more {
		t.Fatal(err)
	}
	kinds := []string{}
	for _, e := range feed {
		kinds = append(kinds, e.Kind)
	}
	if !slices.Equal(kinds, []string{"card.moved", "card.updated", "card.created"}) {
		t.Fatalf("feed %v", kinds)
	}
	if feed[0].Data["to"] != "done" || feed[0].Actor == nil || feed[0].Actor.ID != f.member {
		t.Fatalf("moved entry %+v", feed[0])
	}
	changes, _ := feed[1].Data["changes"].([]any)
	if len(changes) != 2 {
		t.Fatalf("update changes %+v", feed[1].Data)
	}
	stranger := f.User("Stranger", "s@example.com")
	_, _, err = f.Activity.CardFeed(f.ctx, stranger, c.ID, nil, 0)
	mustCode(t, err, domain.ErrNotFound)
}

func TestLaneMoveToleratesEqualKeys(t *testing.T) {
	f := setup(t)
	a := f.card(t, "A")
	b := f.card(t, "B", func(c *domain.NewCard) { c.ProjectID = f.otherProj })
	x := f.card(t, "X")
	// Legacy data: two projects' cards with the same key.
	if _, err := tdb.Pool.Exec(f.ctx, `UPDATE cards SET position = 'V' WHERE id = ANY($1)`, []uuid.UUID{a.ID, b.ID}); err != nil {
		t.Fatal(err)
	}
	lo, hi := a.ID, b.ID
	if hi.String() < lo.String() {
		lo, hi = hi, lo // board order breaks position ties by id
	}
	moved, err := f.Cards.Move(f.ctx, f.member, x.ID, domain.Move{Version: x.Version, Status: ptr(domain.Todo), AfterID: &lo, BeforeID: &hi})
	if err != nil || moved.Position <= "V" {
		t.Fatalf("tie fallback: %q %v", moved.Position, err)
	}
}
