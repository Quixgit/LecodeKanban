// Package domain holds projects.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Status string

const (
	StatusPending    Status = "pending"
	StatusInProgress Status = "in_progress"
	StatusCompleted  Status = "completed"
)

func (s Status) Valid() bool {
	return s == StatusPending || s == StatusInProgress || s == StatusCompleted
}

var (
	Tones = []string{"teal", "amber", "purple", "red", "neutral"}
	Icons = []string{"folder", "rocket", "shield", "code", "target", "sparkles", "globe", "megaphone", "layers", "flask"}
)

type Project struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Key         string
	Name        string
	Description string
	Status      Status
	PICID       *uuid.UUID
	Team        *string
	Icon        string
	Tone        string
	StartDate   *time.Time
	Deadline    *time.Time
	TaskCount   int
	DoneCount   int
	AvgProgress int // average progress of live cards (ADR 0010)
	CreatedBy   *uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Progress is the average progress of the project's cards, 0–100 (ADR 0010).
func (p Project) Progress() int {
	if p.TaskCount == 0 {
		if p.Status == StatusCompleted {
			return 100
		}
		return 0
	}
	return p.AvgProgress
}

// Overdue reports a missed deadline on a project that is not completed.
func (p Project) Overdue(today time.Time) bool {
	return p.Status != StatusCompleted && p.Deadline != nil && p.Deadline.Before(today)
}

// Ref is the small projection other modules embed (cards show project key/name).
type Ref struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Key         string
	Name        string
	Icon        string
	Tone        string
}

type Filter struct {
	Query    string
	Status   *Status
	PICID    *uuid.UUID
	Team     *string
	Progress string // not_started | early | midway | almost | done
	Deadline string // overdue | week | month | later | none
	Sort     string // updated | name | deadline | progress | created
	Desc     bool
}

type Summary struct {
	Total, Completed, InProgress, Pending, Overdue int
	Teams                                          []string
}

// NewProject is the validated create input.
type NewProject struct {
	Key         string
	Name        string
	Description string
	Status      Status
	PICID       *uuid.UUID
	Team        *string
	Icon        string
	Tone        string
	StartDate   *time.Time
	Deadline    *time.Time
}

// Patch updates fields; Set* flags distinguish "clear" from "unchanged" for nullable fields.
type Patch struct {
	Name, Description, Icon, Tone *string
	Status                        *Status
	SetPIC                        bool
	PICID                         *uuid.UUID
	SetTeam                       bool
	Team                          *string
	SetStart                      bool
	StartDate                     *time.Time
	SetDeadline                   bool
	Deadline                      *time.Time
}

var (
	ErrNotFound = apperr.Define("projects.not_found", http.StatusNotFound)
	ErrKeyTaken = apperr.Define("projects.key_taken", http.StatusConflict)
)
