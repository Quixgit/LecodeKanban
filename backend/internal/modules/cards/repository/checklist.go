package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

func itemToDomain(i store.ChecklistItem) domain.ChecklistItem {
	return domain.ChecklistItem{ID: i.ID, CardID: i.CardID, Text: i.Text, Done: i.Done, Position: i.Position,
		CreatedAt: i.CreatedAt, CompletedAt: i.CompletedAt}
}

func (r *Repo) Checklist(ctx context.Context, card uuid.UUID) ([]domain.ChecklistItem, error) {
	rows, err := r.q.ListChecklist(ctx, card)
	if err != nil {
		return nil, err
	}
	out := make([]domain.ChecklistItem, len(rows))
	for i, it := range rows {
		out[i] = itemToDomain(it)
	}
	return out, nil
}

func (r *Repo) ChecklistItem(ctx context.Context, id uuid.UUID) (domain.ChecklistItem, error) {
	it, err := r.q.GetChecklistItem(ctx, id)
	if db.IsNoRows(err) {
		return domain.ChecklistItem{}, apperr.Wrap(domain.ErrItemNotFound, "checklist item not found", err)
	}
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	return itemToDomain(it), nil
}

func (r *Repo) ChecklistCount(ctx context.Context, card uuid.UUID) (int, error) {
	n, err := r.q.CountChecklist(ctx, card)
	return int(n), err
}

func (r *Repo) LastChecklistPosition(ctx context.Context, card uuid.UUID) (string, error) {
	return r.q.LastChecklistPosition(ctx, card)
}

func (r *Repo) ChecklistNextAfter(ctx context.Context, card uuid.UUID, after string) (string, error) {
	return r.q.NextChecklistPositionAfter(ctx, store.NextChecklistPositionAfterParams{CardID: card, After: after})
}

func (r *Repo) ChecklistPrevBefore(ctx context.Context, card uuid.UUID, before string) (string, error) {
	return r.q.PrevChecklistPositionBefore(ctx, store.PrevChecklistPositionBeforeParams{CardID: card, Before: before})
}

func (r *Repo) AddChecklistItem(ctx context.Context, card uuid.UUID, text, position string) (domain.ChecklistItem, error) {
	it, err := r.q.CreateChecklistItem(ctx, store.CreateChecklistItemParams{CardID: card, Text: text, Position: position})
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	return itemToDomain(it), nil
}

// ItemPatch changes any subset of an item's fields.
type ItemPatch struct {
	Text     *string
	Done     *bool
	Position *string
}

func (r *Repo) UpdateChecklistItem(ctx context.Context, id uuid.UUID, p ItemPatch) (domain.ChecklistItem, error) {
	params := store.UpdateChecklistItemParams{ID: id, Text: p.Text, Position: p.Position}
	if p.Done != nil {
		params.Done = pgtype.Bool{Bool: *p.Done, Valid: true}
	}
	it, err := r.q.UpdateChecklistItem(ctx, params)
	if err != nil {
		return domain.ChecklistItem{}, err
	}
	return itemToDomain(it), nil
}

func (r *Repo) DeleteChecklistItem(ctx context.Context, id uuid.UUID) error {
	return r.q.DeleteChecklistItem(ctx, id)
}

// RefreshChecklist recounts a card's checklist and stores the derived progress.
func (r *Repo) RefreshChecklist(ctx context.Context, card uuid.UUID) (domain.Card, error) {
	c, err := r.q.RefreshChecklistCounts(ctx, card)
	if err != nil {
		return domain.Card{}, notFound(err)
	}
	d := toDomain(c)
	if p := domain.DeriveProgress(d.Status, d.ChecklistTotal, d.ChecklistDone); p != d.Progress {
		if err := r.SetProgress(ctx, card, p); err != nil {
			return domain.Card{}, err
		}
		d.Progress = p
	}
	return d, nil
}
