package chat

import (
	"context"

	"github.com/google/uuid"

	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	commentevents "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/events"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

// RegisterFeeds writes task updates into task-feed channels. Handlers return errors only so the bus
// can log them: a failing feed never breaks the board.
func RegisterFeeds(bus *eventbus.Bus, svc *service.Service) {
	ofCard := func(kind string, c cardevents.Card) service.FeedEvent {
		return service.FeedEvent{Kind: kind, WorkspaceID: c.WorkspaceID, ProjectID: c.ProjectID, CardID: c.CardID,
			ActorID: c.ActorID, Number: c.Number, Title: c.Title}
	}
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardCreated) error {
		ev := ofCard("created", e.Card)
		ev.To, ev.Assignees = e.Status, e.Assignees
		if len(e.Assignees) > 0 {
			ev.Also = []string{"assigned"}
		}
		return svc.PostFeed(ctx, ev)
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardMoved) error {
		if e.From == e.To {
			return nil // a reorder inside a column is not news
		}
		ev := ofCard("moved", e.Card)
		ev.From, ev.To, ev.Column = e.From, e.To, e.ColumnName
		return svc.PostFeed(ctx, ev)
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardUpdated) error {
		ev := ofCard("updated", e.Card)
		assigned, other := false, false
		for _, c := range e.Changes {
			ev.Changes = append(ev.Changes, service.FeedChangeIn{Field: c.Field, From: c.From, To: c.To})
			switch {
			case c.Field == "assignees":
				// Someone newly on the task (the change carries only what was added and removed).
				assigned = assigned || len(feedIDs(c.To)) > 0
				other = other || len(feedIDs(c.To)) == 0
			case c.Field != "description":
				other = true
			}
		}
		switch {
		case assigned && !other:
			ev.Kind = "assigned"
		case assigned:
			ev.Also = []string{"assigned"}
		}
		return svc.PostFeed(ctx, ev)
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardDeleted) error {
		return svc.PostFeed(ctx, ofCard("deleted", e.Card))
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e commentevents.CommentCreated) error {
		return svc.PostFeed(ctx, service.FeedEvent{Kind: "commented", WorkspaceID: e.WorkspaceID, ProjectID: e.ProjectID,
			CardID: e.CardID, ActorID: e.ActorID, Number: e.CardNumber, Title: e.CardTitle, Excerpt: e.Excerpt})
	})
}

// feedIDs reads the ids out of a change's added/removed list.
func feedIDs(v any) []uuid.UUID {
	ids, _ := v.([]uuid.UUID)
	return ids
}
