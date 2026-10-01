package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

func labelToDomain(l store.Label) domain.Label {
	return domain.Label{ID: l.ID, WorkspaceID: l.WorkspaceID, Name: l.Name, Tone: l.Tone}
}

func labelErr(err error) error {
	switch {
	case db.IsNoRows(err):
		return apperr.Wrap(domain.ErrLabelNotFound, "label not found", err)
	case db.IsUniqueViolation(err, "labels_workspace_name"):
		return apperr.Wrap(domain.ErrLabelExists, "a label with this name already exists", err)
	}
	return err
}

func (r *Repo) Labels(ctx context.Context, ws uuid.UUID) ([]domain.Label, error) {
	rows, err := r.q.ListLabels(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Label, len(rows))
	for i, l := range rows {
		out[i] = labelToDomain(l)
	}
	return out, nil
}

func (r *Repo) Label(ctx context.Context, id uuid.UUID) (domain.Label, error) {
	l, err := r.q.GetLabel(ctx, id)
	if err != nil {
		return domain.Label{}, labelErr(err)
	}
	return labelToDomain(l), nil
}

func (r *Repo) CreateLabel(ctx context.Context, ws uuid.UUID, name, tone string) (domain.Label, error) {
	l, err := r.q.CreateLabel(ctx, store.CreateLabelParams{WorkspaceID: ws, Name: name, Tone: tone})
	if err != nil {
		return domain.Label{}, labelErr(err)
	}
	return labelToDomain(l), nil
}

func (r *Repo) UpdateLabel(ctx context.Context, id uuid.UUID, name, tone *string) (domain.Label, error) {
	l, err := r.q.UpdateLabel(ctx, store.UpdateLabelParams{ID: id, Name: name, Tone: tone})
	if err != nil {
		return domain.Label{}, labelErr(err)
	}
	return labelToDomain(l), nil
}

func (r *Repo) DeleteLabel(ctx context.Context, id uuid.UUID) error { return r.q.DeleteLabel(ctx, id) }

// AllLabelsIn reports whether every id is a label of ws.
func (r *Repo) AllLabelsIn(ctx context.Context, ws uuid.UUID, ids []uuid.UUID) (bool, error) {
	n, err := r.q.CountLabelsInWorkspace(ctx, store.CountLabelsInWorkspaceParams{WorkspaceID: ws, Ids: ids})
	return int(n) == len(ids), err
}

func (r *Repo) SetLabels(ctx context.Context, card uuid.UUID, labels []uuid.UUID) error {
	if err := r.q.ClearCardLabels(ctx, card); err != nil {
		return err
	}
	if len(labels) == 0 {
		return nil
	}
	return r.q.AddCardLabels(ctx, store.AddCardLabelsParams{CardID: card, LabelIds: labels})
}

// CardLabels returns label ids per card, ordered by label name.
func (r *Repo) CardLabels(ctx context.Context, cards []uuid.UUID) (map[uuid.UUID][]uuid.UUID, error) {
	out := map[uuid.UUID][]uuid.UUID{}
	if len(cards) == 0 {
		return out, nil
	}
	rows, err := r.q.LabelsForCards(ctx, cards)
	if err != nil {
		return nil, err
	}
	for _, l := range rows {
		out[l.CardID] = append(out[l.CardID], l.LabelID)
	}
	return out, nil
}
