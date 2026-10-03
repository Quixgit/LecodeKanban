package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// FeedEvent is a task update on its way into feed channels.
type FeedEvent struct {
	// Kind is created, moved, updated, deleted or commented.
	Kind        string
	WorkspaceID uuid.UUID
	ProjectID   uuid.UUID
	CardID      uuid.UUID
	ActorID     uuid.UUID
	Number      int
	Title       string
	From, To    string
	Column      string
	Excerpt     string
	Changes     []FeedChangeIn
}

// FeedChangeIn is a field change as the cards module reports it (values may be ids or lists of ids).
type FeedChangeIn struct {
	Field    string
	From, To any
}

// eventPayload is what clients receive in a message's `event`.
type eventPayload struct {
	Kind        string        `json:"kind"`
	ProjectID   uuid.UUID     `json:"projectId"`
	ProjectKey  string        `json:"projectKey"`
	ProjectName string        `json:"projectName"`
	CardID      uuid.UUID     `json:"cardId"`
	Number      int           `json:"number"`
	Title       string        `json:"title"`
	From        string        `json:"from,omitempty"`
	To          string        `json:"to,omitempty"`
	Column      string        `json:"column,omitempty"`
	Excerpt     string        `json:"excerpt,omitempty"`
	Changes     []eventChange `json:"changes,omitempty"`
}

type eventChange struct {
	Field string   `json:"field"`
	From  string   `json:"from,omitempty"`
	To    string   `json:"to,omitempty"`
	Added []string `json:"added,omitempty"`
	Gone  []string `json:"removed,omitempty"`
}

func (s *Service) feedProject(ctx context.Context, ws uuid.UUID, project *uuid.UUID) (*uuid.UUID, error) {
	if project == nil {
		return nil, nil
	}
	if s.projects == nil {
		return nil, apperr.New(domain.ErrNotFound, "not found")
	}
	p, err := s.projects.Ref(ctx, *project)
	if err != nil || p.WorkspaceID != ws {
		var v validation.V
		v.Add("feedProjectId", validation.NotFound, nil)
		return nil, v.Err()
	}
	return project, nil
}

func idStrings(v any) []string {
	var out []string
	switch x := v.(type) {
	case []uuid.UUID:
		for _, id := range x {
			out = append(out, id.String())
		}
	case []string:
		out = append(out, x...)
	case []any:
		for _, e := range x {
			if str, ok := e.(string); ok {
				out = append(out, str)
			}
		}
	}
	return out
}

func scalar(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case fmt.Stringer:
		return x.String()
	default:
		return fmt.Sprint(x)
	}
}

// PostFeed writes a task update into every feed channel that takes it. It never fails the caller's
// action: errors are returned only for the event bus to log.
func (s *Service) PostFeed(ctx context.Context, e FeedEvent) error {
	if s.projects == nil {
		return nil
	}
	channels, err := s.repo.FeedChannels(ctx, e.WorkspaceID, e.ProjectID)
	if err != nil || len(channels) == 0 {
		return err
	}
	proj, err := s.projects.Ref(ctx, e.ProjectID)
	if err != nil {
		return err
	}
	p := eventPayload{Kind: e.Kind, ProjectID: e.ProjectID, ProjectKey: proj.Key, ProjectName: proj.Name, CardID: e.CardID,
		Number: e.Number, Title: e.Title, From: e.From, To: e.To, Column: e.Column, Excerpt: e.Excerpt}

	// Assignees arrive as ids; show names.
	var ids []uuid.UUID
	for _, c := range e.Changes {
		if c.Field == "assignees" {
			for _, id := range append(idStrings(c.From), idStrings(c.To)...) {
				if u, err := uuid.Parse(id); err == nil {
					ids = append(ids, u)
				}
			}
		}
	}
	names, err := s.people(ctx, ids)
	if err != nil {
		return err
	}
	nameOf := func(id string) string {
		if u, err := uuid.Parse(id); err == nil {
			if p, ok := names[u]; ok {
				return p.Name
			}
		}
		return id
	}
	for _, c := range e.Changes {
		switch c.Field {
		case "description": // too noisy for a feed
			continue
		case "assignees":
			ch := eventChange{Field: c.Field}
			for _, id := range idStrings(c.To) {
				ch.Added = append(ch.Added, nameOf(id))
			}
			for _, id := range idStrings(c.From) {
				ch.Gone = append(ch.Gone, nameOf(id))
			}
			p.Changes = append(p.Changes, ch)
		case "labels":
			p.Changes = append(p.Changes, eventChange{Field: c.Field, Added: idStrings(c.To), Gone: idStrings(c.From)})
		default:
			p.Changes = append(p.Changes, eventChange{Field: c.Field, From: scalar(c.From), To: scalar(c.To)})
		}
	}
	if e.Kind == "updated" && len(p.Changes) == 0 {
		return nil
	}
	payload, err := json.Marshal(p)
	if err != nil {
		return err
	}
	body := fmt.Sprintf("%s %s-%d %s", e.Kind, proj.Key, e.Number, e.Title)
	if e.Kind == "moved" {
		body += ": " + e.From + " → " + e.To
	}
	body = strings.TrimSpace(body)
	var firstErr error
	for _, ch := range channels {
		m, err := s.repo.InsertEvent(ctx, ch.ID, &e.ActorID, body, payload)
		if err != nil {
			firstErr = err
			continue
		}
		_ = s.repo.TouchChannel(ctx, ch.ID, m.CreatedAt)
		s.hint(ctx, "chat.message", e.WorkspaceID, e.ActorID, ch.ID, &m.ID)
	}
	return firstErr
}
