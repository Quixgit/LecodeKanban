// Package domain holds boards and columns.
package domain

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Category maps a column onto the workflow status shared by all views.
type Category string

const (
	Todo       Category = "todo"
	InProgress Category = "in_progress"
	InReview   Category = "in_review"
	Done       Category = "done"
)

var Categories = []Category{Todo, InProgress, InReview, Done}

func (c Category) Valid() bool {
	for _, x := range Categories {
		if x == c {
			return true
		}
	}
	return false
}

type Column struct {
	ID          uuid.UUID
	BoardID     uuid.UUID
	ProjectID   uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Category    Category
	Position    string
	WIPLimit    *int
}

type Board struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	ProjectID   uuid.UUID
	Name        string
	Columns     []Column
}

// SavedView is a personal, named board/list configuration. Config is an opaque JSON object
// owned by the frontend (filters, swimlanes, project).
type SavedView struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	Name        string
	Config      json.RawMessage
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

const (
	MaxColumns       = 12
	MaxWIPLimit      = 999
	MaxViewsPerUser  = 50
	MaxViewConfigLen = 4096
)

var (
	ErrBoardNotFound      = apperr.Define("boards.not_found", http.StatusNotFound)
	ErrColumnNotFound     = apperr.Define("boards.column_not_found", http.StatusNotFound)
	ErrColumnNotEmpty     = apperr.Define("boards.column_not_empty", http.StatusConflict)
	ErrLastColumnOfStatus = apperr.Define("boards.last_column_of_status", http.StatusUnprocessableEntity)
	ErrTooManyColumns     = apperr.Define("boards.too_many_columns", http.StatusUnprocessableEntity)
	ErrViewNotFound       = apperr.Define("boards.view_not_found", http.StatusNotFound)
	ErrInvalidMove        = apperr.Define("boards.invalid_move", http.StatusUnprocessableEntity)
)

// DefaultColumnNames are the localized names of the four default columns.
var DefaultColumnNames = map[string]map[Category]string{
	"en": {Todo: "To Do", InProgress: "In Progress", InReview: "In Review", Done: "Completed"},
	"uk": {Todo: "До виконання", InProgress: "В роботі", InReview: "На перевірці", Done: "Виконано"},
}
