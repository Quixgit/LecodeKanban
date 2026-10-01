package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Move places a card between optional neighbours (writes only this card). See domain.Move for
// the column-scoped (project board) and status-scoped (cross-project board) modes.
func (s *Service) Move(ctx context.Context, user, id uuid.UUID, m domain.Move) (View, error) {
	cur, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	if m.Status != nil && !m.Status.Valid() {
		var v validation.V
		v.OneOf("status", string(*m.Status), "todo", "in_progress", "in_review", "done")
		return View{}, v.Err()
	}
	laneMode := m.ColumnID == nil && m.Status != nil
	if m.ColumnID == nil && m.Status == nil {
		m.ColumnID = &cur.ColumnID
	}
	col, err := s.targetColumn(ctx, cur.ProjectID, m.ColumnID, m.Status)
	if err != nil {
		return View{}, err
	}
	status := domain.Status(col.Category)
	sc := scope{column: col.ID, ws: cur.WorkspaceID, status: status, lane: laneMode, self: id}
	invalid := apperr.New(domain.ErrInvalidMove, "neighbour cards are not adjacent in the target column")
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		pos, err := sc.position(ctx, r, m.AfterID, m.BeforeID)
		if err != nil {
			return err
		}
		if pos == "" {
			return invalid
		}
		card, err = r.Move(ctx, repository.MoveTo{ID: id, ColumnID: col.ID, BoardID: col.BoardID, Status: status,
			Position: pos, Progress: domain.DeriveProgress(status, cur.ChecklistTotal, cur.ChecklistDone), Version: m.Version})
		if err != nil {
			return err
		}
		if card.Status != cur.Status {
			from := cur.Status
			return r.Transition(ctx, card, &from, user)
		}
		return nil
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardMoved{Card: evCard(card, user), From: string(cur.Status), To: string(card.Status),
		ColumnName: col.Name})
	return s.presentOne(ctx, card)
}

// scope is the ordered sequence a card is placed in: one column, or one status lane of a workspace.
type scope struct {
	column, ws, self uuid.UUID
	status           domain.Status
	lane             bool
}

func (sc scope) lookup(ctx context.Context, r *repository.Repo, id uuid.UUID) (string, bool, error) {
	if sc.lane {
		return r.PositionInStatus(ctx, id, sc.ws, sc.status)
	}
	return r.PositionIn(ctx, id, sc.column)
}

func (sc scope) next(ctx context.Context, r *repository.Repo, after string) (string, error) {
	if sc.lane {
		return r.NextAfterInStatus(ctx, sc.ws, sc.status, after)
	}
	return r.NextAfter(ctx, sc.column, after)
}

func (sc scope) prev(ctx context.Context, r *repository.Repo, before string) (string, error) {
	if sc.lane {
		return r.PrevBeforeInStatus(ctx, sc.ws, sc.status, before)
	}
	return r.PrevBefore(ctx, sc.column, before)
}

func (sc scope) last(ctx context.Context, r *repository.Repo) (string, error) {
	if sc.lane {
		return r.LastInStatus(ctx, sc.ws, sc.status)
	}
	return r.LastPosition(ctx, sc.column)
}

// position computes a fractional key between the neighbours (or at the end). Returns "" when
// neighbours are not in the scope or out of order.
func (sc scope) position(ctx context.Context, r *repository.Repo, after, before *uuid.UUID) (string, error) {
	get := func(id *uuid.UUID) (string, bool, error) {
		if id == nil || *id == sc.self {
			return "", false, nil
		}
		return sc.lookup(ctx, r, *id)
	}
	a, hasA, err := get(after)
	if err != nil {
		return "", err
	}
	b, hasB, err := get(before)
	if err != nil {
		return "", err
	}
	if (after != nil && *after != sc.self && !hasA) || (before != nil && *before != sc.self && !hasB) {
		return "", nil
	}
	if sc.lane && hasA && hasB && a >= b {
		// Equal keys from independent columns (legacy data): land right after the tie group.
		hasB = false
	}
	switch {
	case hasA && !hasB:
		if b, err = sc.next(ctx, r, a); err != nil {
			return "", err
		}
	case hasB && !hasA:
		if a, err = sc.prev(ctx, r, b); err != nil {
			return "", err
		}
	case !hasA && !hasB:
		if a, err = sc.last(ctx, r); err != nil {
			return "", err
		}
	}
	key, err := fractional.BetweenUnique(a, b)
	if err != nil {
		return "", nil
	}
	return key, nil
}
