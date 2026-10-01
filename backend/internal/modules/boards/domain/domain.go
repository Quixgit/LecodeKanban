// Package domain holds boards and columns.
package domain

import (
	"net/http"

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

var (
	ErrBoardNotFound  = apperr.Define("boards.not_found", http.StatusNotFound)
	ErrColumnNotFound = apperr.Define("boards.column_not_found", http.StatusNotFound)
)

// DefaultColumnNames are the localized names of the four default columns.
var DefaultColumnNames = map[string]map[Category]string{
	"en": {Todo: "To Do", InProgress: "In Progress", InReview: "In Review", Done: "Completed"},
	"uk": {Todo: "До виконання", InProgress: "В роботі", InReview: "На перевірці", Done: "Виконано"},
}
