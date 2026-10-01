// Package repository persists comments and their mentions.
package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/repository/store"
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

func toDomain(c store.Comment) domain.Comment {
	out := domain.Comment{ID: c.ID, WorkspaceID: c.WorkspaceID, CardID: c.CardID, Body: c.Body,
		CreatedAt: c.CreatedAt, EditedAt: c.EditedAt}
	if c.AuthorID.Valid {
		id := c.AuthorID.UUID
		out.AuthorID = &id
	}
	return out
}

func (r *Repo) List(ctx context.Context, card uuid.UUID) ([]domain.Comment, error) {
	rows, err := r.q.ListComments(ctx, card)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Comment, len(rows))
	ids := make([]uuid.UUID, len(rows))
	for i, c := range rows {
		out[i] = toDomain(c)
		ids[i] = c.ID
	}
	if len(ids) == 0 {
		return out, nil
	}
	mentions, err := r.q.MentionsForComments(ctx, ids)
	if err != nil {
		return nil, err
	}
	byComment := map[uuid.UUID][]uuid.UUID{}
	for _, m := range mentions {
		byComment[m.CommentID] = append(byComment[m.CommentID], m.UserID)
	}
	for i := range out {
		out[i].Mentions = byComment[out[i].ID]
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Comment, error) {
	c, err := r.q.GetComment(ctx, id)
	if db.IsNoRows(err) {
		return domain.Comment{}, apperr.Wrap(domain.ErrNotFound, "comment not found", err)
	}
	if err != nil {
		return domain.Comment{}, err
	}
	out := toDomain(c)
	mentions, err := r.q.MentionsForComments(ctx, []uuid.UUID{id})
	if err != nil {
		return domain.Comment{}, err
	}
	for _, m := range mentions {
		out.Mentions = append(out.Mentions, m.UserID)
	}
	return out, nil
}

func (r *Repo) Create(ctx context.Context, ws, card, author uuid.UUID, body string) (domain.Comment, error) {
	c, err := r.q.CreateComment(ctx, store.CreateCommentParams{WorkspaceID: ws, CardID: card,
		AuthorID: uuid.NullUUID{UUID: author, Valid: true}, Body: body})
	if err != nil {
		return domain.Comment{}, err
	}
	return toDomain(c), nil
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, body string) (domain.Comment, error) {
	c, err := r.q.UpdateComment(ctx, store.UpdateCommentParams{ID: id, Body: body})
	if err != nil {
		return domain.Comment{}, err
	}
	return toDomain(c), nil
}

func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error { return r.q.DeleteComment(ctx, id) }

func (r *Repo) Count(ctx context.Context, card uuid.UUID) (int, error) {
	n, err := r.q.CountComments(ctx, card)
	return int(n), err
}

func (r *Repo) SetMentions(ctx context.Context, comment uuid.UUID, users []uuid.UUID) error {
	if err := r.q.ClearMentions(ctx, comment); err != nil {
		return err
	}
	if len(users) == 0 {
		return nil
	}
	return r.q.AddMentions(ctx, store.AddMentionsParams{CommentID: comment, UserIds: users})
}
