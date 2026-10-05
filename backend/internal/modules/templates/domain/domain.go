// Package domain holds task templates, recurring schedules and the pure calculation of the next run.
package domain

import (
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Template is the starting point of a task.
type Template struct {
	ID, WorkspaceID uuid.UUID
	Name            string
	Title           string
	Description     string
	Priority        string
	LabelIDs        []uuid.UUID
	AssigneeIDs     []uuid.UUID
	Checklist       []string
	Subtasks        []string
	DueInDays       *int
	CreatedBy       *uuid.UUID
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Limits keep one template and one workspace bounded.
const (
	MaxTemplates       = 200
	MaxRecurring       = 100
	MaxChecklistItems  = 50
	MaxSubtasks        = 30
	MaxItemLength      = 300
	MaxLabelsPerTask   = 10
	MaxAssigneesInTask = 20
)

type Freq string

const (
	Daily   Freq = "daily"
	Weekly  Freq = "weekly"
	Monthly Freq = "monthly"
)

func (f Freq) Valid() bool { return f == Daily || f == Weekly || f == Monthly }

// Recurrence turns a template into a task on a schedule: every day, on chosen weekdays, or on a day of the month
// (a 31st falls on the last day of shorter months), at a full hour in the given time zone.
type Recurrence struct {
	ID, WorkspaceID, TemplateID, ProjectID uuid.UUID
	Freq                                   Freq
	Weekdays                               []int // 1 = Monday … 7 = Sunday
	MonthDay                               int
	Hour                                   int
	Timezone                               string
	Active                                 bool
	NextRunAt                              time.Time
	LastRunAt                              *time.Time
	LastCardID                             *uuid.UUID
	LastError                              *string
	CreatedBy                              uuid.UUID
	CreatedAt                              time.Time
}

var (
	ErrNotFound         = apperr.Define("templates.not_found", http.StatusNotFound)
	ErrRecurringMissing = apperr.Define("templates.recurring_not_found", http.StatusNotFound)
	ErrNameTaken        = apperr.Define("templates.name_taken", http.StatusConflict)
	ErrTooMany          = apperr.Define("templates.too_many", http.StatusUnprocessableEntity)
)

func weekday(t time.Time) int { return (int(t.Weekday())+6)%7 + 1 }

func daysIn(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// Next is the first moment after `after` on which the schedule fires; the zero time when it never does
// (a weekly schedule without weekdays, an unknown zone). Computed on the local calendar of the zone, so
// "every day at 09:00" stays at 09:00 across daylight-saving changes.
func (r Recurrence) Next(after time.Time) time.Time {
	loc, err := time.LoadLocation(r.Timezone)
	if err != nil || !r.Freq.Valid() || (r.Freq == Weekly && len(r.Weekdays) == 0) {
		return time.Time{}
	}
	local := after.In(loc)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	for i := 0; i < 400; i++ {
		d := day.AddDate(0, 0, i)
		ok := false
		switch r.Freq {
		case Daily:
			ok = true
		case Weekly:
			ok = slices.Contains(r.Weekdays, weekday(d))
		case Monthly:
			want := min(max(r.MonthDay, 1), daysIn(d.Year(), d.Month()))
			ok = d.Day() == want
		}
		if !ok {
			continue
		}
		at := time.Date(d.Year(), d.Month(), d.Day(), r.Hour, 0, 0, 0, loc)
		if at.After(after) {
			return at.UTC()
		}
	}
	return time.Time{}
}
