// Package service implements custom fields: administrators define them per workspace,
// anyone who can edit a card fills them in.
package service

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Cards authorises access to a card (cards module).
type Cards interface {
	Ref(ctx context.Context, user, card uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

type Service struct {
	repo  *repository.Repo
	cards Cards
	ws    Workspaces
}

func New(repo *repository.Repo, cards Cards, ws Workspaces) *Service {
	return &Service{repo: repo, cards: cards, ws: ws}
}

// MaxCardsPerLookup bounds the board lookup.
const MaxCardsPerLookup = 500

func (s *Service) List(ctx context.Context, user, ws uuid.UUID) ([]domain.Field, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.List(ctx, ws)
}

func cleanOptions(v *validation.V, kind domain.Kind, in []domain.Option) []domain.Option {
	if kind != domain.Select {
		return []domain.Option{}
	}
	if len(in) == 0 || len(in) > domain.MaxOptions {
		v.Add("options", validation.Count, map[string]any{"min": 1, "max": domain.MaxOptions})
		return in
	}
	seen := map[string]bool{}
	out := make([]domain.Option, 0, len(in))
	for _, o := range in {
		o.Label = strings.TrimSpace(o.Label)
		if o.Label == "" || utf8.RuneCountInString(o.Label) > domain.MaxOptionLen {
			v.Add("options", validation.MaxLength, map[string]any{"max": domain.MaxOptionLen})
			continue
		}
		if !slices.Contains(domain.Tones, o.Tone) {
			o.Tone = "neutral"
		}
		if o.ID == "" {
			o.ID = uuid.NewString()[:8]
		}
		if seen[o.ID] || seen[strings.ToLower(o.Label)] {
			v.Add("options", validation.OneOf, nil)
			continue
		}
		seen[o.ID], seen[strings.ToLower(o.Label)] = true, true
		out = append(out, o)
	}
	return out
}

func checkName(v *validation.V, name string) string {
	name = strings.TrimSpace(name)
	if v.Required("name", name) {
		v.Length("name", name, 1, domain.MaxNameLen)
	}
	return name
}

func (s *Service) Create(ctx context.Context, user, ws uuid.UUID, in domain.NewField) (domain.Field, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermFieldsManage); err != nil {
		return domain.Field{}, err
	}
	var v validation.V
	in.Name = checkName(&v, in.Name)
	in.Description = strings.TrimSpace(in.Description)
	v.Length("description", in.Description, 0, domain.MaxDescription)
	if !in.Kind.Valid() {
		v.OneOf("kind", string(in.Kind), "text", "number", "date", "select", "checkbox", "url")
	}
	in.Options = cleanOptions(&v, in.Kind, in.Options)
	if err := v.Err(); err != nil {
		return domain.Field{}, err
	}
	n, err := s.repo.Count(ctx, ws)
	if err != nil {
		return domain.Field{}, err
	}
	if n >= domain.MaxFields {
		return domain.Field{}, apperr.New(domain.ErrTooMany, "too many custom fields")
	}
	return s.repo.Create(ctx, ws, in)
}

// fieldIn loads a field and checks the caller may manage fields of its workspace.
func (s *Service) fieldIn(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Field, error) {
	f, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Field{}, err
	}
	if _, err := s.ws.Authorize(ctx, f.WorkspaceID, user, perm); err != nil {
		// A person outside the workspace must not learn that the field exists.
		return domain.Field{}, apperr.New(domain.ErrNotFound, "field not found")
	}
	return f, nil
}

func (s *Service) Update(ctx context.Context, user, id uuid.UUID, p domain.FieldPatch) (domain.Field, error) {
	f, err := s.fieldIn(ctx, user, id, wsdomain.PermFieldsManage)
	if err != nil {
		return domain.Field{}, err
	}
	var v validation.V
	if p.Name != nil {
		n := checkName(&v, *p.Name)
		p.Name = &n
	}
	if p.Description != nil {
		d := strings.TrimSpace(*p.Description)
		v.Length("description", d, 0, domain.MaxDescription)
		p.Description = &d
	}
	if p.Options != nil {
		if f.Kind != domain.Select {
			v.Add("options", validation.OneOf, nil)
		} else {
			o := cleanOptions(&v, f.Kind, *p.Options)
			p.Options = &o
		}
	}
	if err := v.Err(); err != nil {
		return domain.Field{}, err
	}
	var out domain.Field
	err = s.repo.InTx(ctx, func(tx *repository.Repo) error {
		var err error
		if out, err = tx.Update(ctx, id, p); err != nil {
			return err
		}
		if p.Options != nil {
			keep := make([]string, len(out.Options))
			for i, o := range out.Options {
				keep[i] = o.ID
			}
			return tx.DropValuesOutside(ctx, id, keep)
		}
		return nil
	})
	return out, err
}

// Delete removes a field and, with it, the values cards had for it.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	if _, err := s.fieldIn(ctx, user, id, wsdomain.PermFieldsManage); err != nil {
		return err
	}
	return s.repo.Archive(ctx, id)
}

// Reorder sets the order of fields; ids must be exactly the workspace's fields.
func (s *Service) Reorder(ctx context.Context, user, ws uuid.UUID, ids []uuid.UUID) error {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermFieldsManage); err != nil {
		return err
	}
	all, err := s.repo.List(ctx, ws)
	if err != nil {
		return err
	}
	if len(ids) != len(all) {
		return apperr.New(domain.ErrNotFound, "field list is out of date")
	}
	known := map[uuid.UUID]bool{}
	for _, f := range all {
		known[f.ID] = true
	}
	for _, id := range ids {
		if !known[id] {
			return apperr.New(domain.ErrNotFound, "field not found")
		}
		delete(known, id)
	}
	return s.repo.SetPositions(ctx, ws, ids)
}

func (s *Service) CardValues(ctx context.Context, user, card uuid.UUID) ([]domain.Value, error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.ValuesForCard(ctx, card)
}

// SetValue stores (or clears, for null or an empty value) one field of a card.
func (s *Service) SetValue(ctx context.Context, user, card, field uuid.UUID, raw json.RawMessage) error {
	ref, err := s.cards.Ref(ctx, user, card, wsdomain.PermEditContent)
	if err != nil {
		return err
	}
	f, err := s.repo.Get(ctx, field)
	if err != nil || f.WorkspaceID != ref.WorkspaceID {
		return apperr.New(domain.ErrNotFound, "field not found")
	}
	val, clear, err := f.Normalize(raw)
	if err != nil {
		return err
	}
	if clear {
		return s.repo.ClearValue(ctx, card, field)
	}
	return s.repo.SetValue(ctx, ref.WorkspaceID, card, field, val)
}

// ValuesForCards backs the board: the values of many cards at once.
func (s *Service) ValuesForCards(ctx context.Context, user, ws uuid.UUID, cards []uuid.UUID) ([]domain.Value, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return []domain.Value{}, nil
	}
	if len(cards) > MaxCardsPerLookup {
		var v validation.V
		v.Add("cardIds", validation.Count, map[string]any{"min": 1, "max": MaxCardsPerLookup})
		return nil, v.Err()
	}
	return s.repo.ValuesForCards(ctx, ws, cards)
}
