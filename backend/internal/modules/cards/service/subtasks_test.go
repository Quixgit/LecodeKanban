package service_test

import (
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

func TestSubtasks(t *testing.T) {
	f := setup(t)
	parent := f.card(t, "Parent")
	sub := func(title string) domain.Card {
		t.Helper()
		v, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: title, ParentID: &parent.ID})
		if err != nil {
			t.Fatal(err)
		}
		if v.Parent == nil || v.Parent.ID != parent.ID {
			t.Fatalf("parent ref missing: %+v", v.Parent)
		}
		return v.Card
	}
	a, b := sub("a"), sub("b")
	get := func() domain.Card {
		t.Helper()
		v, err := f.Cards.Get(f.ctx, f.owner, parent.ID)
		if err != nil {
			t.Fatal(err)
		}
		return v.Card
	}
	if p := get(); p.SubtaskTotal != 2 || p.SubtaskDone != 0 {
		t.Fatalf("counts after create: %d/%d", p.SubtaskDone, p.SubtaskTotal)
	}

	if _, err := f.Cards.Move(f.ctx, f.member, a.ID, domain.Move{Version: a.Version, Status: ptr(domain.Done)}); err != nil {
		t.Fatal(err)
	}
	if p := get(); p.SubtaskDone != 1 || p.Progress != 50 {
		t.Fatalf("1/2 done: %d/%d progress %d", p.SubtaskDone, p.SubtaskTotal, p.Progress)
	}

	// One level only; same project only.
	if _, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.project, Title: "deep", ParentID: &a.ID}); err == nil {
		t.Fatal("a subtask must not become a parent")
	}
	if _, err := f.Cards.Create(f.ctx, f.member, f.ws, domain.NewCard{ProjectID: f.otherProj, Title: "x", ParentID: &parent.ID}); err == nil {
		t.Fatal("parent must be in the same project")
	}

	kids, _, err := f.Cards.List(f.ctx, f.owner, f.ws, domain.Filter{ParentID: &parent.ID}, pagination.Params{Page: 1, Size: 50})
	if err != nil || len(kids) != 2 {
		t.Fatalf("children filter: %d %v", len(kids), err)
	}

	if err := f.Cards.Delete(f.ctx, f.member, b.ID); err != nil {
		t.Fatal(err)
	}
	if p := get(); p.SubtaskTotal != 1 || p.SubtaskDone != 1 {
		t.Fatalf("after deleting a subtask: %d/%d", p.SubtaskDone, p.SubtaskTotal)
	}
	if err := f.Cards.Delete(f.ctx, f.member, parent.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.Cards.Get(f.ctx, f.owner, a.ID); err == nil {
		t.Fatal("deleting a parent must delete its subtasks")
	}
}
