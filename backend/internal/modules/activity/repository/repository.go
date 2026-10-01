// Package repository persists activity entries.
package repository

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/repository/store"
)

type Repo struct{ q *store.Queries }

func New(pool *pgxpool.Pool) *Repo { return &Repo{q: store.New(pool)} }

func nullable(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func ptr(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func (r *Repo) Insert(ctx context.Context, e domain.Entry) error {
	data, err := json.Marshal(e.Data)
	if err != nil {
		return err
	}
	if e.Data == nil {
		data = []byte("{}")
	}
	return r.q.InsertActivity(ctx, store.InsertActivityParams{WorkspaceID: e.WorkspaceID, ProjectID: nullable(e.ProjectID),
		CardID: nullable(e.CardID), ActorID: nullable(e.ActorID), Kind: e.Kind, Data: data})
}

// ForCard returns a card's entries newest first; before (an entry id) pages backwards.
func (r *Repo) ForCard(ctx context.Context, card uuid.UUID, before *int64, limit int) ([]domain.Entry, error) {
	params := store.CardActivityParams{CardID: uuid.NullUUID{UUID: card, Valid: true}, Lim: int32(limit)} //nolint:gosec // G115: ≤ MaxPage
	if before != nil {
		params.Before = pgtype.Int8{Int64: *before, Valid: true}
	}
	rows, err := r.q.CardActivity(ctx, params)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Entry, len(rows))
	for i, a := range rows {
		e := domain.Entry{ID: a.ID, WorkspaceID: a.WorkspaceID, ProjectID: ptr(a.ProjectID), CardID: ptr(a.CardID),
			ActorID: ptr(a.ActorID), Kind: a.Kind, At: a.At}
		if err := json.Unmarshal(a.Data, &e.Data); err != nil {
			return nil, err
		}
		out[i] = e
	}
	return out, nil
}
