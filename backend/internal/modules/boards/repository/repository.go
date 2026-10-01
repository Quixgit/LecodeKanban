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

// ColumnPatch changes a column's name and/or WIP limit (SetWIP with nil WIP clears it).
type ColumnPatch struct {
	Name   *string
	SetWIP bool
	WIP    *int
}

func (r *Repo) AddColumn(ctx context.Context, board uuid.UUID, name string, cat domain.Category, pos string, wip *int) (uuid.UUID, error) {
	c, err := r.q.CreateColumn(ctx, store.CreateColumnParams{BoardID: board, Name: name, Category: string(cat), Position: pos})
	if err != nil {
		return uuid.Nil, err
	}
	if wip != nil {
		_, err = r.UpdateColumn(ctx, c.ID, ColumnPatch{SetWIP: true, WIP: wip})
	}
	return c.ID, err
}

func (r *Repo) UpdateColumn(ctx context.Context, id uuid.UUID, p ColumnPatch) (uuid.UUID, error) {
	params := store.UpdateColumnParams{ID: id, Name: p.Name, SetWip: p.SetWIP}
	if p.WIP != nil {
		n := int32(*p.WIP) //nolint:gosec // G115: validated ≤ MaxWIPLimit
		params.WipLimit = &n
	}
	c, err := r.q.UpdateColumn(ctx, params)
	if db.IsNoRows(err) {
		return uuid.Nil, apperr.Wrap(domain.ErrColumnNotFound, "column not found", err)
	}
	return c.ID, err
}

func (r *Repo) SetColumnPosition(ctx context.Context, id uuid.UUID, pos string) error {
	return r.q.SetColumnPosition(ctx, store.SetColumnPositionParams{ID: id, Position: pos})
}

// OtherColumnInCategory returns another column of the same status on the board.
func (r *Repo) OtherColumnInCategory(ctx context.Context, board uuid.UUID, cat domain.Category, exclude uuid.UUID) (uuid.UUID, error) {
	id, err := r.q.OtherColumnInCategory(ctx, store.OtherColumnInCategoryParams{BoardID: board, Category: string(cat), Exclude: exclude})
	if db.IsNoRows(err) {
		return uuid.Nil, apperr.Wrap(domain.ErrLastColumnOfStatus, "each status needs at least one column", err)
	}
	return id, err
}

func (r *Repo) DeleteColumn(ctx context.Context, id uuid.UUID) error {
	return r.q.DeleteColumn(ctx, id)
}

// CountColumns returns the board's column total and how many have the category.
func (r *Repo) CountColumns(ctx context.Context, board uuid.UUID, cat domain.Category) (total, inCategory int, err error) {
	row, err := r.q.CountColumns(ctx, store.CountColumnsParams{BoardID: board, Category: string(cat)})
	return int(row.Total), int(row.InCategory), err
}

func (r *Repo) LastColumnInCategory(ctx context.Context, board uuid.UUID, cat domain.Category) (string, error) {
	return r.q.LastColumnInCategory(ctx, store.LastColumnInCategoryParams{BoardID: board, Category: string(cat)})
}

func (r *Repo) NextColumnAfter(ctx context.Context, board uuid.UUID, after string) (string, error) {
	return r.q.NextColumnPositionAfter(ctx, store.NextColumnPositionAfterParams{BoardID: board, After: after})
}

func (r *Repo) PrevColumnBefore(ctx context.Context, board uuid.UUID, before string) (string, error) {
	return r.q.PrevColumnPositionBefore(ctx, store.PrevColumnPositionBeforeParams{BoardID: board, Before: before})
}

func (r *Repo) LastColumn(ctx context.Context, board uuid.UUID) (string, error) {
	return r.q.LastColumnPosition(ctx, board)
}

func toView(v store.SavedView) domain.SavedView {
	return domain.SavedView{ID: v.ID, WorkspaceID: v.WorkspaceID, UserID: v.UserID, Name: v.Name, Config: v.Config,
		CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt}
}

func (r *Repo) Views(ctx context.Context, ws, user uuid.UUID) ([]domain.SavedView, error) {
	rows, err := r.q.ListViews(ctx, store.ListViewsParams{WorkspaceID: ws, UserID: user})
	if err != nil {
		return nil, err
	}
	out := make([]domain.SavedView, len(rows))
	for i, v := range rows {
		out[i] = toView(v)
	}
	return out, nil
}

func (r *Repo) CountViews(ctx context.Context, ws, user uuid.UUID) (int, error) {
	n, err := r.q.CountViews(ctx, store.CountViewsParams{WorkspaceID: ws, UserID: user})
	return int(n), err
}

func (r *Repo) View(ctx context.Context, id uuid.UUID) (domain.SavedView, error) {
	v, err := r.q.GetView(ctx, id)
	if db.IsNoRows(err) {
		return domain.SavedView{}, apperr.Wrap(domain.ErrViewNotFound, "view not found", err)
	}
	if err != nil {
		return domain.SavedView{}, err
	}
	return toView(v), nil
}

func (r *Repo) CreateView(ctx context.Context, ws, user uuid.UUID, name string, config []byte) (domain.SavedView, error) {
	v, err := r.q.CreateView(ctx, store.CreateViewParams{WorkspaceID: ws, UserID: user, Name: name, Config: config})
	if err != nil {
		return domain.SavedView{}, err
	}
	return toView(v), nil
}

func (r *Repo) UpdateView(ctx context.Context, id uuid.UUID, name *string, config []byte) (domain.SavedView, error) {
	v, err := r.q.UpdateView(ctx, store.UpdateViewParams{ID: id, Name: name, Config: config})
	if err != nil {
		return domain.SavedView{}, err
	}
	return toView(v), nil
}

func (r *Repo) DeleteView(ctx context.Context, id uuid.UUID) error { return r.q.DeleteView(ctx, id) }
