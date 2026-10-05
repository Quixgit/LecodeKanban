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
	// ArchivedAt is when the task went to the trash (nil for a live task).
	ArchivedAt *time.Time
	Assignees  []uuid.UUID
	Labels     []uuid.UUID
	ParentID   *uuid.UUID

	SubtaskTotal    int
	SubtaskDone     int
	ChecklistTotal  int
	ChecklistDone   int
	CommentCount    int
	AttachmentCount int
}

// Ref is the minimal card data other modules (comments, attachments, activity) work with.
type Ref struct {
	ID, WorkspaceID, ProjectID uuid.UUID
	Number                     int
	Title                      string
}

// stageProgress is the progress of a card without a checklist, by workflow stage (ADR 0010).
var stageProgress = map[Status]int{Todo: 0, InProgress: 40, InReview: 80, Done: 100}

// DeriveProgress computes a card's progress: completed cards are 100%; otherwise the share of
// checked checklist items and subtasks (callers pass their sums) (capped at 99% so 100% always means "done"), or the stage weight.
func DeriveProgress(s Status, checklistTotal, checklistDone int) int {
	if s == Done {
		return 100
	}
	if checklistTotal > 0 {
		return min(checklistDone*100/checklistTotal, 99)
	}
	return stageProgress[s]
}

type Label struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Tone        string
}

var LabelTones = []string{"teal", "amber", "purple", "red", "neutral"}

type ChecklistItem struct {
	ID          uuid.UUID
	CardID      uuid.UUID
	Text        string
	Done        bool
	Position    string
	CreatedAt   time.Time
	CompletedAt *time.Time
}

// Change describes one edited field (feeds the activity log).
type Change struct {
	Field    string
	From, To any
}

type Filter struct {
	Status     *Status
	ProjectID  *uuid.UUID
	AssigneeID *uuid.UUID
	Priority   *Priority
	LabelID    *uuid.UUID
	ParentID   *uuid.UUID
	Query      string
	Due        string     // overdue | today | week | month | none
	Sort       string     // key | title | assignee | project | progress | deadline | priority | position | updated
	SortField  *uuid.UUID // sort by this custom field instead of Sort
	// FieldID with FieldValue keeps the cards whose custom field matches (FieldContains: a text search).
	FieldID       *uuid.UUID
	FieldValue    string
	FieldContains bool
	Desc          bool
}

type NewCard struct {
	ProjectID   uuid.UUID
	ColumnID    *uuid.UUID
	Status      Status
	Title       string
	Description string
	Priority    Priority
	DueDate     *time.Time
	AssigneeIDs []uuid.UUID
	LabelIDs    []uuid.UUID
	ParentID    *uuid.UUID // makes the card a subtask of this card
}

type Patch struct {
	Version     int
	Title       *string
	Description *string
	Priority    *Priority
	SetDue      bool
	DueDate     *time.Time
	AssigneeIDs *[]uuid.UUID
	LabelIDs    *[]uuid.UUID
}

// Move places a card. With ColumnID the neighbours must sit in that column (project board);
// with only Status the neighbours may be any cards of that status in the workspace
// (the cross-project board), and the card lands in its project's first column of the status.
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
	ErrLabelNotFound   = apperr.Define("cards.label_not_found", http.StatusNotFound)
	ErrLabelExists     = apperr.Define("cards.label_exists", http.StatusConflict)
	ErrItemNotFound    = apperr.Define("cards.checklist_item_not_found", http.StatusNotFound)
	ErrChecklistFull   = apperr.Define("cards.checklist_full", http.StatusUnprocessableEntity)
	// ErrCannotRestore: the task's project is gone, or its parent task is still in the trash.
	ErrCannotRestore = apperr.Define("cards.cannot_restore", http.StatusUnprocessableEntity)
)

// MaxChecklistItems bounds one card's checklist.
const MaxChecklistItems = 100
