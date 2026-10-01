package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Checklist returns a card's items in order.
func (s *Service) Checklist(ctx context.Context, user, card uuid.UUID) ([]domain.ChecklistItem, error) {
	if _, err := s.load(ctx, user, card, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Checklist(ctx, card)
}

func validateItemText(text *string) error {
	*text = strings.TrimSpace(*text)
	var v validation.V
	if v.Required("text", *text) {
		v.Length("text", *text, 1, 300)
	}
	return v.Err()
}

// AddChecklistItem appends an item and refreshes the card's derived progress.
func (s *Service) AddChecklistItem(ctx context.Context, user, cardID uuid.UUID, text string) (domain.ChecklistItem, error) {
	card, err := s.load(ctx, user, cardID, wsdomain.PermEditContent)
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	if err := validateItemText(&text); err != nil {
		return domain.ChecklistItem{}, err
	}
	var item domain.ChecklistItem
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		n, err := r.ChecklistCount(ctx, cardID)
		if err != nil {
			return err
		}
		if n >= domain.MaxChecklistItems {
			return apperr.New(domain.ErrChecklistFull, "checklist is full").WithMeta("max", domain.MaxChecklistItems)
		}
		last, err := r.LastChecklistPosition(ctx, cardID)
		if err != nil {
			return err
		}
		pos, err := fractional.Between(last, "")
		if err != nil {
			return err
		}
		if item, err = r.AddChecklistItem(ctx, cardID, text, pos); err != nil {
			return err
		}
		_, err = r.RefreshChecklist(ctx, cardID)
		return err
	})
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	s.checklistChanged(ctx, card, user, "added", text)
	return item, nil
}

// ItemPatch edits text / done, or reorders between neighbours (AfterID / BeforeID).
type ItemPatch struct {
	Text              *string
	Done              *bool
	Move              bool
	AfterID, BeforeID *uuid.UUID
}

// loadItem authorises perm on the item's card.
func (s *Service) loadItem(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.ChecklistItem, domain.Card, error) {
	item, err := s.repo.ChecklistItem(ctx, id)
	if err != nil {
		return domain.ChecklistItem{}, domain.Card{}, err
	}
	card, err := s.load(ctx, user, item.CardID, perm)
	if apperr.IsCode(err, domain.ErrNotFound) {
		return domain.ChecklistItem{}, domain.Card{}, apperr.New(domain.ErrItemNotFound, "checklist item not found")
	}
	return item, card, err
}

func (s *Service) UpdateChecklistItem(ctx context.Context, user, id uuid.UUID, p ItemPatch) (domain.ChecklistItem, error) {
	item, card, err := s.loadItem(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	if p.Text != nil {
		if err := validateItemText(p.Text); err != nil {
			return domain.ChecklistItem{}, err
		}
	}
	var out domain.ChecklistItem
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		rp := repository.ItemPatch{Text: p.Text, Done: p.Done}
		if p.Move {
			pos, err := s.itemPosition(ctx, r, item, p.AfterID, p.BeforeID)
			if err != nil {
				return err
			}
			rp.Position = &pos
		}
		var err error
		if out, err = r.UpdateChecklistItem(ctx, id, rp); err != nil {
			return err
		}
		if p.Done != nil {
			_, err = r.RefreshChecklist(ctx, item.CardID)
		}
		return err
	})
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	switch {
	case p.Done != nil && *p.Done != item.Done && *p.Done:
		s.checklistChanged(ctx, card, user, "checked", out.Text)
	case p.Done != nil && *p.Done != item.Done:
		s.checklistChanged(ctx, card, user, "unchecked", out.Text)
	case p.Text != nil && *p.Text != item.Text:
		s.checklistChanged(ctx, card, user, "renamed", out.Text)
	case p.Move:
		s.checklistChanged(ctx, card, user, "reordered", out.Text)
	}
	return out, nil
}

// itemPosition places an item between neighbours of the same card.
func (s *Service) itemPosition(ctx context.Context, r *repository.Repo, item domain.ChecklistItem, after, before *uuid.UUID) (string, error) {
	invalid := apperr.New(domain.ErrInvalidMove, "neighbour items are not on this card")
	neighbour := func(id *uuid.UUID) (string, error) {
		if id == nil || *id == item.ID {
			return "", nil
		}
		n, err := r.ChecklistItem(ctx, *id)
		if err != nil || n.CardID != item.CardID {
			return "", invalid
		}
		return n.Position, nil
	}
	a, err := neighbour(after)
	if err != nil {
		return "", err
	}
	b, err := neighbour(before)
	if err != nil {
		return "", err
	}
	switch {
	case a != "" && b == "":
		b, err = r.ChecklistNextAfter(ctx, item.CardID, a)
	case b != "" && a == "":
		a, err = r.ChecklistPrevBefore(ctx, item.CardID, b)
	case a == "" && b == "":
		a, err = r.LastChecklistPosition(ctx, item.CardID)
	}
	if err != nil {
		return "", err
	}
	key, err := fractional.Between(a, b)
	if err != nil {
		return "", invalid
	}
	return key, nil
}

func (s *Service) DeleteChecklistItem(ctx context.Context, user, id uuid.UUID) error {
	item, card, err := s.loadItem(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return err
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.DeleteChecklistItem(ctx, id); err != nil {
			return err
		}
		_, err := r.RefreshChecklist(ctx, item.CardID)
		return err
	})
	if err != nil {
		return err
	}
	s.checklistChanged(ctx, card, user, "removed", item.Text)
	return nil
}

func (s *Service) checklistChanged(ctx context.Context, card domain.Card, user uuid.UUID, action, text string) {
	_ = s.bus.Publish(ctx, events.ChecklistChanged{Card: evCard(card, user), Action: action, Text: text})
}
