// Package repository persists custom field definitions and card values.
package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error { return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)}) })
}

func toDomain(f store.CustomField) domain.Field {
	opts := []domain.Option{}
	_ = json.Unmarshal(f.Options, &opts)
	return domain.Field{ID: f.ID, WorkspaceID: f.WorkspaceID, Name: f.Name, Description: f.Description,
		Kind: domain.Kind(f.Kind), Options: opts, ShowOnCard: f.ShowOnCard, Position: int(f.Position), CreatedAt: f.CreatedAt}
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.New(domain.ErrNotFound, "field not found")
	}
	return err
}

func taken(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return apperr.New(domain.ErrNameTaken, "a field with this name already exists")
	}
	return err
}

func (r *Repo) List(ctx context.Context, ws uuid.UUID) ([]domain.Field, error) {
	rows, err := r.q.ListFields(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Field, len(rows))
	for i, f := range rows {
		out[i] = toDomain(f)
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Field, error) {
	f, err := r.q.GetField(ctx, id)
	if err != nil {
		return domain.Field{}, notFound(err)
	}
	return toDomain(f), nil
}

func (r *Repo) Count(ctx context.Context, ws uuid.UUID) (int, error) {
	n, err := r.q.CountFields(ctx, ws)
	return int(n), err
}

func (r *Repo) Create(ctx context.Context, ws uuid.UUID, in domain.NewField) (domain.Field, error) {
	opts, _ := json.Marshal(in.Options)
	f, err := r.q.CreateField(ctx, store.CreateFieldParams{WorkspaceID: ws, Name: in.Name, Description: in.Description,
		Kind: string(in.Kind), Options: opts, ShowOnCard: in.ShowOnCard})
	if err != nil {
		return domain.Field{}, taken(err)
	}
	return toDomain(f), nil
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, p domain.FieldPatch) (domain.Field, error) {
	var opts []byte
	if p.Options != nil {
		opts, _ = json.Marshal(*p.Options)
	}
	var show pgtype.Bool
	if p.ShowOnCard != nil {
		show = pgtype.Bool{Bool: *p.ShowOnCard, Valid: true}
	}
	f, err := r.q.UpdateField(ctx, store.UpdateFieldParams{ID: id, Name: p.Name, Description: p.Description,
		Options: opts, ShowOnCard: show})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Field{}, notFound(err)
		}
		return domain.Field{}, taken(err)
	}
	return toDomain(f), nil
}

func (r *Repo) Archive(ctx context.Context, id uuid.UUID) error { return r.q.ArchiveField(ctx, id) }

func (r *Repo) SetPositions(ctx context.Context, ws uuid.UUID, ids []uuid.UUID) error {
	for i, id := range ids {
		if err := r.q.SetFieldPosition(ctx, store.SetFieldPositionParams{ID: id, Position: int32(i), WorkspaceID: ws}); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repo) DropValuesOutside(ctx context.Context, field uuid.UUID, keep []string) error {
	return r.q.DeleteValuesOutsideOptions(ctx, store.DeleteValuesOutsideOptionsParams{FieldID: field, Keep: keep})
}

func values(rows []store.CardFieldValue) []domain.Value {
	out := make([]domain.Value, len(rows))
	for i, v := range rows {
		out[i] = domain.Value{CardID: v.CardID, FieldID: v.FieldID, Value: v.Value}
	}
	return out
}

func (r *Repo) ValuesForCard(ctx context.Context, card uuid.UUID) ([]domain.Value, error) {
	rows, err := r.q.ListValuesForCard(ctx, card)
	return values(rows), err
}

func (r *Repo) ValuesForCards(ctx context.Context, ws uuid.UUID, cards []uuid.UUID) ([]domain.Value, error) {
	rows, err := r.q.ListValuesForCards(ctx, store.ListValuesForCardsParams{WorkspaceID: ws, CardIds: cards})
	return values(rows), err
}

func (r *Repo) SetValue(ctx context.Context, ws, card, field uuid.UUID, v json.RawMessage) error {
	return r.q.UpsertValue(ctx, store.UpsertValueParams{CardID: card, FieldID: field, WorkspaceID: ws, Value: v})
}

func (r *Repo) ClearValue(ctx context.Context, card, field uuid.UUID) error {
	return r.q.DeleteValue(ctx, store.DeleteValueParams{CardID: card, FieldID: field})
}
