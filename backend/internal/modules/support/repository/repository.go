// Package repository persists support requests.
package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const cols = `id, workspace_id, author_id, kind, subject, message, page_url, user_agent, screenshot IS NOT NULL, status, created_at, updated_at, resolved_at`

func scan(row pgx.Row) (domain.Request, error) {
	var r domain.Request
	var kind, status string
	err := row.Scan(&r.ID, &r.WorkspaceID, &r.AuthorID, &kind, &r.Subject, &r.Message, &r.PageURL, &r.UserAgent, &r.HasScreenshot,
		&status, &r.CreatedAt, &r.UpdatedAt, &r.ResolvedAt)
	r.Kind, r.Status = domain.Kind(kind), domain.Status(status)
	return r, err
}

func (r *Repo) Create(ctx context.Context, x domain.Request, shot *domain.Screenshot) (domain.Request, error) {
	var data []byte
	var typ *string
	if shot != nil {
		data, typ = shot.Data, &shot.ContentType
	}
	return scan(r.pool.QueryRow(ctx, `INSERT INTO support_requests
		(workspace_id, author_id, kind, subject, message, page_url, user_agent, screenshot, screenshot_type)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+cols,
		x.WorkspaceID, x.AuthorID, string(x.Kind), x.Subject, x.Message, x.PageURL, x.UserAgent, data, typ))
}

// List returns a workspace's requests, newest first; a non-nil author narrows them to that person's own.
func (r *Repo) List(ctx context.Context, ws uuid.UUID, author *uuid.UUID, status *domain.Status) ([]domain.Request, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+cols+` FROM support_requests
		WHERE workspace_id = $1 AND ($2::uuid IS NULL OR author_id = $2) AND ($3::text IS NULL OR status = $3)
		ORDER BY created_at DESC LIMIT 300`, ws, author, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Request{}
	for rows.Next() {
		x, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Request, error) {
	x, err := scan(r.pool.QueryRow(ctx, `SELECT `+cols+` FROM support_requests WHERE id = $1`, id))
	if db.IsNoRows(err) {
		return domain.Request{}, apperr.Wrap(domain.ErrNotFound, "request not found", err)
	}
	return x, err
}

func (r *Repo) CountOpen(ctx context.Context, ws, author uuid.UUID) (n int, err error) {
	err = r.pool.QueryRow(ctx, `SELECT count(*) FROM support_requests WHERE workspace_id = $1 AND author_id = $2 AND status <> 'resolved'`, ws, author).Scan(&n)
	return
}

func (r *Repo) SetStatus(ctx context.Context, id uuid.UUID, status domain.Status) (domain.Request, error) {
	x, err := scan(r.pool.QueryRow(ctx, `UPDATE support_requests SET status = $2, updated_at = now(),
		resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END WHERE id = $1 RETURNING `+cols, id, string(status)))
	if db.IsNoRows(err) {
		return domain.Request{}, apperr.Wrap(domain.ErrNotFound, "request not found", err)
	}
	return x, err
}

func (r *Repo) Screenshot(ctx context.Context, id uuid.UUID) (domain.Screenshot, error) {
	var s domain.Screenshot
	var typ *string
	err := r.pool.QueryRow(ctx, `SELECT screenshot, screenshot_type FROM support_requests WHERE id = $1 AND screenshot IS NOT NULL`, id).Scan(&s.Data, &typ)
	if db.IsNoRows(err) {
		return s, apperr.Wrap(domain.ErrNotFound, "no screenshot", err)
	}
	if typ != nil {
		s.ContentType = *typ
	}
	return s, err
}
