// Package domain holds time entries: work logged against a card.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Entry is one block of work. A running timer has no EndedAt; its Seconds are set when it stops.
type Entry struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	CardID      uuid.UUID
	UserID      uuid.UUID
	StartedAt   time.Time
	EndedAt     *time.Time
	Seconds     int
	Note        string
	Manual      bool
	CreatedAt   time.Time
}

func (e Entry) Running() bool { return e.EndedAt == nil }

// Elapsed is the logged duration; for a running timer, the time since it started.
func (e Entry) Elapsed(now time.Time) int {
	if e.Running() {
		return max(int(now.Sub(e.StartedAt).Seconds()), 0)
	}
	return e.Seconds
}

// Manual entries are bounded to a day: longer work belongs in several entries.
const (
	MinManualSeconds = 60
	MaxManualSeconds = 24 * 60 * 60
	MaxNote          = 500
)

var (
	ErrNotFound  = apperr.Define("time.not_found", http.StatusNotFound)
	ErrForbidden = apperr.Define("time.forbidden", http.StatusForbidden)
	ErrNotActive = apperr.Define("time.not_running", http.StatusConflict)
)
