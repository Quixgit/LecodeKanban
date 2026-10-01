// Package domain holds cards (tasks).
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Status string

const (
	Todo       Status = "todo"
	InProgress Status = "in_progress"
	InReview   Status = "in_review"
	Done       Status = "done"
)

var Statuses = []Status{Todo, InProgress, InReview, Done}

func (s Status) Valid() bool {
	for _, x := range Statuses {
		if x == s {
			return true
		}
	}
	return false
}

type Priority string

const (
	High   Priority = "high"
	Medium Priority = "medium"
	Low    Priority = "low"
)

func (p Priority) Valid() bool { return p == High || p == Medium || p == Low }

type Card struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	ProjectID   uuid.UUID
	BoardID     uuid.UUID
	ColumnID    uuid.UUID
	Number      int
	Title       string
	Description string
	Status      Status
	Priority    Priority
	Progress    int
	DueDate     *time.Time
	Position    string
	Version     int
	CreatedBy   *uuid.UUID
	CompletedAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Assignees   []uuid.UUID
}

type Filter struct {
	Status     *Status
	ProjectID  *uuid.UUID
	AssigneeID *uuid.UUID
	Priority   *Priority
	Query      string
	Due        string // overdue | today | week | month | none
	Sort       string // key | title | assignee | project | progress | deadline | priority | position | updated
	Desc       bool
}

type NewCard struct {
	ProjectID   uuid.UUID
	ColumnID    *uuid.UUID
	Status      Status
	Title       string
	Description string
	Priority    Priority
	Progress    int
	DueDate     *time.Time
	AssigneeIDs []uuid.UUID
}

type Patch struct {
	Version     int
	Title       *string
	Description *string
	Priority    *Priority
	Progress    *int
	SetDue      bool
	DueDate     *time.Time
	AssigneeIDs *[]uuid.UUID
}

type Move struct {
	Version  int
	ColumnID *uuid.UUID
	Status   *Status
	AfterID  *uuid.UUID
	BeforeID *uuid.UUID
}

type Counts map[Status]int

type KPIs struct {
	Active, Total, InReview, Overdue                             int
	DoneThisWeek, DonePrevWeek, CreatedThisWeek, CreatedPrevWeek int
}

type Day struct {
	Date   time.Time
	Counts Counts // todo = created that day; others = transitions into the status
}

type Transition struct {
	ID        int64
	CardID    uuid.UUID
	ProjectID uuid.UUID
	Title     string
	Number    int
	From      *Status
	To        Status
	ActorID   *uuid.UUID
	At        time.Time
}

type Stats struct {
	KPIs     KPIs
	Counts   Counts
	Daily    []Day
	Activity []Transition
}

var (
	ErrNotFound        = apperr.Define("cards.not_found", http.StatusNotFound)
	ErrVersionConflict = apperr.Define("cards.version_conflict", http.StatusConflict)
	ErrInvalidMove     = apperr.Define("cards.invalid_move", http.StatusUnprocessableEntity)
)
