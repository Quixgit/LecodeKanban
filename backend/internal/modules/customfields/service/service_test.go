package service_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/domain"
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

func TestFieldsAndValues(t *testing.T) {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	ctx := context.Background()
	owner := e.User("Olena Owner", "o@example.com")
	member := e.User("Maria Member", "m@example.com")
	viewer := e.User("Vira Viewer", "v@example.com")
	stranger := e.User("Stranger", "s@example.com")
	ws := e.Workspace(owner, map[uuid.UUID]wsdomain.Role{member: wsdomain.RoleMember, viewer: wsdomain.RoleViewer}, tdb.Pool)
	card := e.Card(member, ws, e.Project(owner, ws, "Core"), "Spec")
	f := e.Fields

	// Only administrators define fields; names are unique and kinds are checked.
	_, err := f.Create(ctx, member, ws, domain.NewField{Name: "Budget", Kind: domain.Number})
	mustCode(t, err, wsdomain.ErrInsufficientRole)
	budget, err := f.Create(ctx, owner, ws, domain.NewField{Name: "  Budget ", Kind: domain.Number, ShowOnCard: true})
	if err != nil || budget.Name != "Budget" || !budget.ShowOnCard {
		t.Fatalf("create: %+v %v", budget, err)
	}
	_, err = f.Create(ctx, owner, ws, domain.NewField{Name: "budget", Kind: domain.Text})
	mustCode(t, err, domain.ErrNameTaken)
	_, err = f.Create(ctx, owner, ws, domain.NewField{Name: "X", Kind: "color"})
	mustCode(t, err, apperr.Validation)
	_, err = f.Create(ctx, owner, ws, domain.NewField{Name: "Risk", Kind: domain.Select})
	mustCode(t, err, apperr.Validation) // a select needs options
	risk, err := f.Create(ctx, owner, ws, domain.NewField{Name: "Risk", Kind: domain.Select,
		Options: []domain.Option{{Label: "Low", Tone: "teal"}, {Label: "High", Tone: "nope"}}})
	if err != nil || len(risk.Options) != 2 || risk.Options[0].ID == "" || risk.Options[1].Tone != "neutral" {
		t.Fatalf("select: %+v %v", risk, err)
	}

	// Everybody in the workspace sees them in order; outsiders do not.
	list, err := f.List(ctx, viewer, ws)
	if err != nil || len(list) != 2 || list[0].ID != budget.ID {
		t.Fatalf("list: %+v %v", list, err)
	}
	_, err = f.List(ctx, stranger, ws)
	mustCode(t, err, wsdomain.ErrNotFound)
	if err := f.Reorder(ctx, owner, ws, []uuid.UUID{risk.ID, budget.ID}); err != nil {
		t.Fatal(err)
	}
	list, _ = f.List(ctx, owner, ws)
	if list[0].ID != risk.ID {
		t.Fatalf("order not saved: %+v", list)
	}
	mustCode(t, f.Reorder(ctx, owner, ws, []uuid.UUID{risk.ID}), domain.ErrNotFound)

	// Members fill values; viewers can read but not write; bad values are refused.
	set := func(user, field uuid.UUID, raw string) error {
		return f.SetValue(ctx, user, card.ID, field, json.RawMessage(raw))
	}
	if err := set(member, budget.ID, `1200.5`); err != nil {
		t.Fatal(err)
	}
	if err := set(member, risk.ID, `"`+risk.Options[1].ID+`"`); err != nil {
		t.Fatal(err)
	}
	mustCode(t, set(member, budget.ID, `"lots"`), domain.ErrBadValue)
	mustCode(t, set(member, risk.ID, `"made-up"`), domain.ErrBadValue)
	mustCode(t, set(viewer, budget.ID, `5`), wsdomain.ErrInsufficientRole)
	mustCode(t, set(stranger, budget.ID, `5`), carddomain.ErrNotFound)
	vals, err := f.CardValues(ctx, viewer, card.ID)
	if err != nil || len(vals) != 2 {
		t.Fatalf("values: %+v %v", vals, err)
	}
	many, err := f.ValuesForCards(ctx, viewer, ws, []uuid.UUID{card.ID})
	if err != nil || len(many) != 2 {
		t.Fatalf("board lookup: %+v %v", many, err)
	}
	_, err = f.ValuesForCards(ctx, viewer, ws, make([]uuid.UUID, 501))
	mustCode(t, err, apperr.Validation)

	// A field of another workspace cannot be set through this card.
	other := e.Workspace(stranger, nil, tdb.Pool)
	foreign, _ := f.Create(ctx, stranger, other, domain.NewField{Name: "Foreign", Kind: domain.Text})
	mustCode(t, set(member, foreign.ID, `"x"`), domain.ErrNotFound)
	_, err = f.Update(ctx, member, foreign.ID, domain.FieldPatch{Name: ptr("hack")})
	mustCode(t, err, domain.ErrNotFound)

	// Removing a select option drops the values that used it; clearing deletes a value.
	keep := []domain.Option{risk.Options[0]}
	if _, err := f.Update(ctx, owner, risk.ID, domain.FieldPatch{Options: &keep}); err != nil {
		t.Fatal(err)
	}
	vals, _ = f.CardValues(ctx, owner, card.ID)
	if len(vals) != 1 || vals[0].FieldID != budget.ID {
		t.Fatalf("option removal: %+v", vals)
	}
	if err := set(member, budget.ID, `null`); err != nil {
		t.Fatal(err)
	}
	vals, _ = f.CardValues(ctx, owner, card.ID)
	if len(vals) != 0 {
		t.Fatalf("clear: %+v", vals)
	}

	// Deleting a field hides it and its values.
	_ = set(member, budget.ID, `7`)
	if err := f.Delete(ctx, owner, budget.ID); err != nil {
		t.Fatal(err)
	}
	mustCode(t, set(member, budget.ID, `8`), domain.ErrNotFound)
	list, _ = f.List(ctx, owner, ws)
	if len(list) != 1 || list[0].ID != risk.ID {
		t.Fatalf("after delete: %+v", list)
	}
	// The name can be used again.
	if _, err := f.Create(ctx, owner, ws, domain.NewField{Name: "Budget", Kind: domain.Text}); err != nil {
		t.Fatalf("reuse name: %v", err)
	}

	// The number of fields is capped.
	for i := 0; i < domain.MaxFields; i++ {
		_, err = f.Create(ctx, owner, ws, domain.NewField{Name: strings.Repeat("n", 3) + string(rune('a'+i%26)) + string(rune('a'+i/26)), Kind: domain.Text})
		if err != nil {
			break
		}
	}
	mustCode(t, err, domain.ErrTooMany)
}

func ptr[T any](v T) *T { return &v }
