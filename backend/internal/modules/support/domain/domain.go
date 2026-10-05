// Package domain holds support requests: what a person asks of the people who run their workspace.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Kind string

const (
	Problem  Kind = "problem"
	Idea     Kind = "idea"
	Question Kind = "question"
)

func (k Kind) Valid() bool { return k == Problem || k == Idea || k == Question }

type Status string

const (
	New        Status = "new"
	InProgress Status = "in_progress"
	Resolved   Status = "resolved"
)

func (s Status) Valid() bool { return s == New || s == InProgress || s == Resolved }

// Request is one message to the workspace's administrators.
type Request struct {
	ID, WorkspaceID, AuthorID uuid.UUID
	Kind                      Kind
	Subject, Message          string
	PageURL, UserAgent        string
	HasScreenshot             bool
	Status                    Status
	CreatedAt, UpdatedAt      time.Time
	ResolvedAt                *time.Time
}

// Screenshot is a small image that came with a request.
type Screenshot struct {
	ContentType string
	Data        []byte
}

// Limits keep a request and a person's flow of requests bounded.
const (
	MaxSubject        = 120
	MaxMessage        = 5000
	MaxScreenshotSize = 2 << 20
	// MaxOpenPerAuthor stops one person from flooding the inbox with unanswered requests.
	MaxOpenPerAuthor = 20
)

var (
	ErrNotFound = apperr.Define("support.not_found", http.StatusNotFound)
	ErrTooMany  = apperr.Define("support.too_many_open", http.StatusTooManyRequests)
	ErrImage    = apperr.Define("support.bad_screenshot", http.StatusUnprocessableEntity)
)
