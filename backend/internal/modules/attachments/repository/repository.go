// Package repository persists attachment metadata (bytes live in domain.Storage).
package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct{ q *store.Queries }

func New(pool *pgxpool.Pool) *Repo { return &Repo{q: store.New(pool)} }

func toDomain(a store.Attachment) domain.Attachment {
	out := domain.Attachment{ID: a.ID, WorkspaceID: a.WorkspaceID, CardID: a.CardID, Name: a.Name,
		ContentType: a.ContentType, Size: a.SizeBytes, StorageKey: a.StorageKey, CreatedAt: a.CreatedAt}
	if a.UploadedBy.Valid {
		id := a.UploadedBy.UUID
		out.UploadedBy = &id
	}
	return out
}

func (r *Repo) List(ctx context.Context, card uuid.UUID) ([]domain.Attachment, error) {
	rows, err := r.q.ListAttachments(ctx, card)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Attachment, len(rows))
	for i, a := range rows {
		out[i] = toDomain(a)
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Attachment, error) {
	a, err := r.q.GetAttachment(ctx, id)
	if db.IsNoRows(err) {
		return domain.Attachment{}, apperr.Wrap(domain.ErrNotFound, "attachment not found", err)
	}
	if err != nil {
		return domain.Attachment{}, err
	}
	return toDomain(a), nil
}

func (r *Repo) Create(ctx context.Context, a domain.Attachment) (domain.Attachment, error) {
	var by uuid.NullUUID
	if a.UploadedBy != nil {
		by = uuid.NullUUID{UUID: *a.UploadedBy, Valid: true}
	}
	row, err := r.q.CreateAttachment(ctx, store.CreateAttachmentParams{WorkspaceID: a.WorkspaceID, CardID: a.CardID,
		Name: a.Name, ContentType: a.ContentType, SizeBytes: a.Size, StorageKey: a.StorageKey, UploadedBy: by})
	if err != nil {
		return domain.Attachment{}, err
	}
	return toDomain(row), nil
}

func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error { return r.q.DeleteAttachment(ctx, id) }

func (r *Repo) Count(ctx context.Context, card uuid.UUID) (int, error) {
	row, err := r.q.CountAttachments(ctx, card)
	return int(row.N), err
}
