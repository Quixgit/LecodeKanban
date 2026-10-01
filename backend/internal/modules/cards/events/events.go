// Package events declares events published by the cards module (consumed by projects
// for progress counters, and later by realtime/activity/integrations).
package events

import "github.com/google/uuid"

type CardCreated struct {
	CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
}

func (CardCreated) EventName() string { return "cards.created" }

type CardUpdated struct {
	CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
}

func (CardUpdated) EventName() string { return "cards.updated" }

type CardMoved struct {
	CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
	From, To                                string
}

func (CardMoved) EventName() string { return "cards.moved" }

type CardDeleted struct {
	CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
}

func (CardDeleted) EventName() string { return "cards.deleted" }
