// Package repository persists boards and columns.
package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository/store"
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

// CreateBoard returns the new board, or ok=false if the project already has one.
func (r *Repo) CreateBoard(ctx context.Context, ws, project uuid.UUID, name string) (store.Board, bool, error) {
	b, err := r.q.CreateBoard(ctx, store.CreateBoardParams{WorkspaceID: ws, ProjectID: project, Name: name})
	if db.IsNoRows(err) {
		return store.Board{}, false, nil
	}
	return b, err == nil, err
}

func (r *Repo) BoardByProject(ctx context.Context, project uuid.UUID) (store.Board, error) {
	b, err := r.q.GetBoardByProject(ctx, project)
	if db.IsNoRows(err) {
		return b, apperr.Wrap(domain.ErrBoardNotFound, "board not found", err)
	}
	return b, err
}

func (r *Repo) CreateColumn(ctx context.Context, board uuid.UUID, name string, cat domain.Category, pos string) error {
	_, err := r.q.CreateColumn(ctx, store.CreateColumnParams{BoardID: board, Name: name, Category: string(cat), Position: pos})
	return err
}

func toColumn(c store.BoardColumn, b store.Board) domain.Column {
	col := domain.Column{ID: c.ID, BoardID: c.BoardID, ProjectID: b.ProjectID, WorkspaceID: b.WorkspaceID,
		Name: c.Name, Category: domain.Category(c.Category), Position: c.Position}
	if c.WipLimit != nil {
		n := int(*c.WipLimit)
		col.WIPLimit = &n
	}
	return col
}

func (r *Repo) Columns(ctx context.Context, b store.Board) ([]domain.Column, error) {
	rows, err := r.q.ListColumns(ctx, b.ID)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Column, len(rows))
	for i, c := range rows {
		out[i] = toColumn(c, b)
	}
	return out, nil
}

func (r *Repo) Column(ctx context.Context, id uuid.UUID) (domain.Column, error) {
	c, err := r.q.GetColumn(ctx, id)
	if db.IsNoRows(err) {
		return domain.Column{}, apperr.Wrap(domain.ErrColumnNotFound, "column not found", err)
	}
	if err != nil {
		return domain.Column{}, err
	}
	return columnRow(c.ID, c.BoardID, c.ProjectID, c.WorkspaceID, c.Name, c.Category, c.Position, c.WipLimit), nil
}

func (r *Repo) FirstColumn(ctx context.Context, project uuid.UUID, cat domain.Category) (domain.Column, error) {
	c, err := r.q.FirstColumnByCategory(ctx, store.FirstColumnByCategoryParams{ProjectID: project, Category: string(cat)})
	if db.IsNoRows(err) {
		return domain.Column{}, apperr.Wrap(domain.ErrColumnNotFound, "no column for status", err)
	}
	if err != nil {
		return domain.Column{}, err
	}
	return columnRow(c.ID, c.BoardID, c.ProjectID, c.WorkspaceID, c.Name, c.Category, c.Position, c.WipLimit), nil
}

func columnRow(id, board, project, ws uuid.UUID, name, cat, pos string, wip *int32) domain.Column {
	col := domain.Column{ID: id, BoardID: board, ProjectID: project, WorkspaceID: ws, Name: name, Category: domain.Category(cat), Position: pos}
	if wip != nil {
		n := int(*wip)
		col.WIPLimit = &n
	}
	return col
}
