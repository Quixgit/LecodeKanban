// Package domain holds card attachments and the storage abstraction behind them.
package domain

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Attachment struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	CardID      uuid.UUID
	Name        string
	ContentType string
	Size        int64
	StorageKey  string
	UploadedBy  *uuid.UUID
	CreatedAt   time.Time
}

// Storage keeps attachment bytes (local disk now; an S3 implementation fits the same interface).
type Storage interface {
	// Put stores at most max bytes from r under key; it fails with ErrTooLarge beyond that.
	Put(ctx context.Context, key string, r io.Reader, max int64) (int64, error)
	Open(ctx context.Context, key string) (io.ReadSeekCloser, error)
	Delete(ctx context.Context, key string) error
}

// MaxPerCard bounds the number of files on one card.
const MaxPerCard = 50

// InlineTypes may be rendered by the browser (previews); everything else is downloaded.
var InlineTypes = map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true}

var (
	ErrNotFound  = apperr.Define("attachments.not_found", http.StatusNotFound)
	ErrTooLarge  = apperr.Define("attachments.too_large", http.StatusRequestEntityTooLarge)
	ErrTooMany   = apperr.Define("attachments.too_many", http.StatusUnprocessableEntity)
	ErrNoFile    = apperr.Define("attachments.no_file", http.StatusBadRequest)
	ErrForbidden = apperr.Define("attachments.forbidden", http.StatusForbidden)
)
