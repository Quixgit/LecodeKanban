package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type BulkAction struct {
	IDs      []uuid.UUID
	Action   string // move | priority | delete
	Status   *domain.Status
	Priority *domain.Priority
}

// Bulk applies one action to many cards of a workspace (last write wins, no version check).
func (s *Service) Bulk(ctx context.Context, user, ws uuid.UUID, a BulkAction) (int, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return 0, err
	}
	var v validation.V
	v.OneOf("action", a.Action, "move", "priority", "delete")
	if len(a.IDs) == 0 || len(a.IDs) > 500 {
		v.Add("ids", validation.Count, map[string]any{"min": 1, "max": 500})
	}
	if a.Action == "move" && (a.Status == nil || !a.Status.Valid()) {
		v.Add("status", validation.Required, nil)
	}
	if a.Action == "priority" && (a.Priority == nil || !a.Priority.Valid()) {
		v.Add("priority", validation.Required, nil)
	}
	if err := v.Err(); err != nil {
		return 0, err
	}
	cards, err := s.repo.InWorkspace(ctx, ws, a.IDs)
	if err != nil {
		return 0, err
	}
	changed := 0
	for _, c := range cards {
		switch a.Action {
		case "delete":
			ok, err := s.repo.Archive(ctx, c.ID)
			if err != nil {
				return changed, err
			}
			if ok {
				_ = s.bus.Publish(ctx, events.CardDeleted{Card: evCard(c, user)})
				changed++
			}
		case "priority":
			if c.Priority == *a.Priority {
				continue
			}
			if _, err := s.repo.Update(ctx, c.ID, domain.Patch{Version: c.Version, Priority: a.Priority}); err != nil {
				return changed, err
			}
			_ = s.bus.Publish(ctx, events.CardUpdated{Card: evCard(c, user), Changes: []events.FieldChange{
				{Field: "priority", From: string(c.Priority), To: string(*a.Priority)}}})
			changed++
		case "move":
			if c.Status == *a.Status {
				continue
			}
			if _, err := s.Move(ctx, user, c.ID, domain.Move{Version: c.Version, Status: a.Status}); err != nil {
				return changed, err
			}
			changed++
		}
	}
	return changed, nil
}
