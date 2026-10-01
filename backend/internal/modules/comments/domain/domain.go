// Package domain holds card comments and @mentions.
package domain

import (
	"net/http"
	"regexp"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Comment struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	CardID      uuid.UUID
	AuthorID    *uuid.UUID
	Body        string
	CreatedAt   time.Time
	EditedAt    *time.Time
	Mentions    []uuid.UUID
}

const MaxBodyLen = 10000

// mentionRe matches the markdown mention token the editor inserts: @[Display Name](user-uuid).
var mentionRe = regexp.MustCompile(`@\[[^\]\n]{1,80}\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)`)

// ParseMentions returns the distinct user ids mentioned in body, in order of appearance.
func ParseMentions(body string) []uuid.UUID {
	var out []uuid.UUID
	seen := map[uuid.UUID]bool{}
	for _, m := range mentionRe.FindAllStringSubmatch(body, 50) {
		id, err := uuid.Parse(m[1])
		if err != nil || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

var (
	ErrNotFound  = apperr.Define("comments.not_found", http.StatusNotFound)
	ErrForbidden = apperr.Define("comments.forbidden", http.StatusForbidden)
)
