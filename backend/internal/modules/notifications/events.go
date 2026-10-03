package notifications

import (
	"context"
	"slices"

	"github.com/google/uuid"

	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	chatevents "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/events"
	commentevents "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

// Register turns events of other modules into notifications. Handlers return errors only so the bus
// can log them: a failing bell never breaks the action that caused it.
func Register(bus *eventbus.Bus, svc *service.Service, cards service.Cards) {
	ptr := func(id uuid.UUID) *uuid.UUID { return &id }
	about := func(ctx context.Context, c cardevents.Card, kind domain.Kind, to uuid.UUID, body string) error {
		return svc.Notify(ctx, domain.Notification{UserID: to, WorkspaceID: c.WorkspaceID, Kind: kind,
			ActorID: ptr(c.ActorID), CardID: ptr(c.CardID), ProjectID: ptr(c.ProjectID), Title: svc.CardTitle(c), Body: body})
	}
	// workers are the people on a card except those in skip (already told something stronger).
	workers := func(ctx context.Context, card uuid.UUID, skip ...uuid.UUID) ([]uuid.UUID, error) {
		ids, err := cards.AssigneeIDs(ctx, card)
		if err != nil {
			return nil, err
		}
		return slices.DeleteFunc(slices.Clone(ids), func(id uuid.UUID) bool { return slices.Contains(skip, id) }), nil
	}

	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardCreated) error {
		for _, id := range e.Assignees {
			if err := about(ctx, e.Card, domain.Assigned, id, ""); err != nil {
				return err
			}
		}
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardUpdated) error {
		var added []uuid.UUID
		edited := false
		for _, c := range e.Changes {
			switch c.Field {
			case "assignees":
				added, _ = c.To.([]uuid.UUID)
			case "description":
			default:
				edited = true
			}
		}
		for _, id := range added {
			if err := about(ctx, e.Card, domain.Assigned, id, ""); err != nil {
				return err
			}
		}
		if !edited {
			return nil
		}
		ids, err := workers(ctx, e.CardID, added...)
		if err != nil {
			return err
		}
		for _, id := range ids {
			if err := about(ctx, e.Card, domain.TaskUpdated, id, ""); err != nil {
				return err
			}
		}
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardMoved) error {
		if e.From == e.To {
			return nil
		}
		ids, err := workers(ctx, e.CardID)
		if err != nil {
			return err
		}
		for _, id := range ids {
			if err := about(ctx, e.Card, domain.TaskMoved, id, e.ColumnName); err != nil {
				return err
			}
		}
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e commentevents.CommentCreated) error {
		ids, err := workers(ctx, e.CardID)
		if err != nil {
			return err
		}
		c := cardevents.Card{CardID: e.CardID, ProjectID: e.ProjectID, WorkspaceID: e.WorkspaceID, ActorID: e.ActorID,
			Number: e.CardNumber, Title: e.CardTitle}
		for _, id := range ids {
			if err := about(ctx, c, domain.TaskCommented, id, e.Excerpt); err != nil {
				return err
			}
		}
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e chatevents.MessagePosted) error {
		chat := func(kind domain.Kind, to uuid.UUID, card *uuid.UUID, title string) error {
			return svc.Notify(ctx, domain.Notification{UserID: to, WorkspaceID: e.WorkspaceID, Kind: kind, ActorID: ptr(e.AuthorID),
				CardID: card, ChannelID: ptr(e.ChannelID), MessageID: ptr(e.MessageID), Title: title, Body: e.Excerpt})
		}
		for _, id := range e.Mentioned {
			if err := chat(domain.Mention, id, nil, e.ChannelName); err != nil {
				return err
			}
		}
		for _, id := range e.Direct {
			if err := chat(domain.DM, id, nil, ""); err != nil {
				return err
			}
		}
		// A message in a task's own conversation reaches the people who work on the task.
		if e.ChannelKind == "card" && e.RefID != nil {
			ids, err := workers(ctx, *e.RefID, append(slices.Clone(e.Mentioned), e.AuthorID)...)
			if err != nil {
				return err
			}
			title := svc.CardTitleByID(ctx, *e.RefID)
			for _, id := range ids {
				if err := chat(domain.TaskCommented, id, e.RefID, title); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
