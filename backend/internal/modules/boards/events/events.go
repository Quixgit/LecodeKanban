// Package events declares events published by the boards module (consumed by realtime and activity).
package events

import "github.com/google/uuid"

// ColumnsChanged reports a column created, renamed, re-limited, reordered or deleted.
type ColumnsChanged struct {
	WorkspaceID, ProjectID, ActorID uuid.UUID
	Action                          string // created | updated | moved | deleted
	Column                          string
}

func (ColumnsChanged) EventName() string { return "boards.columns_changed" }
