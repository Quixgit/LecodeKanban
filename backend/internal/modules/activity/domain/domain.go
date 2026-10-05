// Package domain holds activity entries: an append-only audit log rendered as feeds.
package domain

import (
	"time"

	"github.com/google/uuid"
)

// Entry is one recorded action. Kind is a stable, translatable key (e.g. "card.moved");
// Data carries kind-specific JSON details (ids, statuses, names).
type Entry struct {
	ID          int64
	WorkspaceID uuid.UUID
	ProjectID   *uuid.UUID
	CardID      *uuid.UUID
	ActorID     *uuid.UUID
	Kind        string
	Data        map[string]any
	At          time.Time
}

// Kinds recorded today; the frontend translates each one.
const (
	CardCreated       = "card.created"
	CardUpdated       = "card.updated"
	CardMoved         = "card.moved"
	CardDeleted       = "card.deleted"
	CardRestored      = "card.restored"
	ChecklistPrefix   = "checklist."
	CommentCreated    = "comment.created"
	CommentDeleted    = "comment.deleted"
	AttachmentAdded   = "attachment.added"
	AttachmentRemoved = "attachment.removed"
	ColumnsPrefix     = "column."
)

const MaxPage = 100
