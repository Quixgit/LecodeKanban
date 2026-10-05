// Package reactions wires cross-module side effects onto the event bus: denormalised counters,
// the activity log and realtime hints. It is the only place that knows about several modules'
// events at once; cmd/server and the test kit both call Register so tests run the real wiring.
package reactions

import (
	"context"

	"github.com/google/uuid"

	activitydomain "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/domain"
	attachevents "github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/events"
	boardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/events"
	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	commentevents "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/events"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
)

type Projects interface {
	Recount(ctx context.Context, project uuid.UUID) error
}

type Cards interface {
	SetCommentCount(ctx context.Context, card uuid.UUID, n int) error
	SetAttachmentCount(ctx context.Context, card uuid.UUID, n int) error
}

type Activity interface {
	Record(ctx context.Context, e activitydomain.Entry) error
}

type Realtime interface {
	Publish(ctx context.Context, m realtime.Message)
}

type Deps struct {
	Projects Projects
	Cards    Cards
	Activity Activity
	Realtime Realtime
}

func ref(id uuid.UUID) *uuid.UUID { return &id }

// cardCtx builds the common parts of activity entries and realtime hints for a card event.
type cardCtx struct{ ws, project, card, actor uuid.UUID }

func (c cardCtx) entry(kind string, data map[string]any) activitydomain.Entry {
	return activitydomain.Entry{WorkspaceID: c.ws, ProjectID: ref(c.project), CardID: ref(c.card), ActorID: ref(c.actor),
		Kind: kind, Data: data}
}

func (c cardCtx) hint(kind string) realtime.Message {
	return realtime.Message{Type: kind, WorkspaceID: c.ws, ProjectID: ref(c.project), CardID: ref(c.card), ActorID: ref(c.actor)}
}

func ofCard(e cardevents.Card) cardCtx {
	return cardCtx{ws: e.WorkspaceID, project: e.ProjectID, card: e.CardID, actor: e.ActorID}
}

// Register subscribes every reaction. Handlers return errors so the bus logs them; publishers
// never fail because of a side effect.
func Register(bus *eventbus.Bus, d Deps) {
	record := func(ctx context.Context, c cardCtx, kind string, data map[string]any) error {
		d.Realtime.Publish(ctx, c.hint(kind))
		return d.Activity.Record(ctx, c.entry(kind, data))
	}

	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardCreated) error {
		if err := d.Projects.Recount(ctx, e.ProjectID); err != nil {
			return err
		}
		return record(ctx, ofCard(e.Card), activitydomain.CardCreated,
			map[string]any{"title": e.Title, "number": e.Number, "status": e.Status})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardUpdated) error {
		changes := make([]map[string]any, len(e.Changes))
		for i, c := range e.Changes {
			changes[i] = map[string]any{"field": c.Field, "from": c.From, "to": c.To}
		}
		return record(ctx, ofCard(e.Card), activitydomain.CardUpdated, map[string]any{"changes": changes})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardMoved) error {
		if e.From != e.To {
			if err := d.Projects.Recount(ctx, e.ProjectID); err != nil {
				return err
			}
			return record(ctx, ofCard(e.Card), activitydomain.CardMoved,
				map[string]any{"from": e.From, "to": e.To, "column": e.ColumnName})
		}
		d.Realtime.Publish(ctx, ofCard(e.Card).hint(activitydomain.CardMoved)) // reorder: no log entry
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardDeleted) error {
		if err := d.Projects.Recount(ctx, e.ProjectID); err != nil {
			return err
		}
		return record(ctx, ofCard(e.Card), activitydomain.CardDeleted, map[string]any{"title": e.Title})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardRestored) error {
		if err := d.Projects.Recount(ctx, e.ProjectID); err != nil {
			return err
		}
		return record(ctx, ofCard(e.Card), activitydomain.CardRestored, map[string]any{"title": e.Title})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.ChecklistChanged) error {
		if err := d.Projects.Recount(ctx, e.ProjectID); err != nil {
			return err
		}
		d.Realtime.Publish(ctx, ofCard(e.Card).hint("checklist.changed"))
		if e.Action == "reordered" {
			return nil
		}
		return d.Activity.Record(ctx, ofCard(e.Card).entry(activitydomain.ChecklistPrefix+e.Action, map[string]any{"text": e.Text}))
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.LabelsChanged) error {
		d.Realtime.Publish(ctx, realtime.Message{Type: "labels.changed", WorkspaceID: e.WorkspaceID, ActorID: ref(e.ActorID)})
		return nil
	})

	ofComment := func(e commentevents.Comment) cardCtx {
		return cardCtx{ws: e.WorkspaceID, project: e.ProjectID, card: e.CardID, actor: e.ActorID}
	}
	eventbus.Subscribe(bus, func(ctx context.Context, e commentevents.CommentCreated) error {
		if err := d.Cards.SetCommentCount(ctx, e.CardID, e.Count); err != nil {
			return err
		}
		return record(ctx, ofComment(e.Comment), activitydomain.CommentCreated,
			map[string]any{"commentId": e.CommentID, "excerpt": e.Excerpt})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e commentevents.CommentUpdated) error {
		d.Realtime.Publish(ctx, ofComment(e.Comment).hint("comment.updated"))
		return nil
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e commentevents.CommentDeleted) error {
		if err := d.Cards.SetCommentCount(ctx, e.CardID, e.Count); err != nil {
			return err
		}
		return record(ctx, ofComment(e.Comment), activitydomain.CommentDeleted, map[string]any{})
	})

	ofAttachment := func(e attachevents.Attachment) cardCtx {
		return cardCtx{ws: e.WorkspaceID, project: e.ProjectID, card: e.CardID, actor: e.ActorID}
	}
	eventbus.Subscribe(bus, func(ctx context.Context, e attachevents.AttachmentAdded) error {
		if err := d.Cards.SetAttachmentCount(ctx, e.CardID, e.Count); err != nil {
			return err
		}
		return record(ctx, ofAttachment(e.Attachment), activitydomain.AttachmentAdded, map[string]any{"name": e.Name})
	})
	eventbus.Subscribe(bus, func(ctx context.Context, e attachevents.AttachmentRemoved) error {
		if err := d.Cards.SetAttachmentCount(ctx, e.CardID, e.Count); err != nil {
			return err
		}
		return record(ctx, ofAttachment(e.Attachment), activitydomain.AttachmentRemoved, map[string]any{"name": e.Name})
	})

	eventbus.Subscribe(bus, func(ctx context.Context, e boardevents.ColumnsChanged) error {
		d.Realtime.Publish(ctx, realtime.Message{Type: "columns.changed", WorkspaceID: e.WorkspaceID,
			ProjectID: ref(e.ProjectID), ActorID: ref(e.ActorID)})
		return d.Activity.Record(ctx, activitydomain.Entry{WorkspaceID: e.WorkspaceID, ProjectID: ref(e.ProjectID),
			ActorID: ref(e.ActorID), Kind: activitydomain.ColumnsPrefix + e.Action, Data: map[string]any{"column": e.Column}})
	})
}
