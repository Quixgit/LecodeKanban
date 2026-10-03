// Package events declares events published by the cards module (consumed by projects for
// progress counters, by activity for the audit log and by realtime for live board updates).
package events

import "github.com/google/uuid"

// Card identifies the card an event is about.
type Card struct {
	CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
	Number                                  int
	Title                                   string
}

type CardCreated struct {
	Card
	Status string
	// Assignees are the people put on the card when it was created.
	Assignees []uuid.UUID
}

func (CardCreated) EventName() string { return "cards.created" }

// FieldChange is one edited field; From/To are JSON-friendly values.
type FieldChange struct {
	Field    string
	From, To any
}

type CardUpdated struct {
	Card
	Changes []FieldChange
}

func (CardUpdated) EventName() string { return "cards.updated" }

type CardMoved struct {
	Card
	From, To   string // statuses
	ColumnName string // target column
}

func (CardMoved) EventName() string { return "cards.moved" }

type CardDeleted struct {
	Card
}

func (CardDeleted) EventName() string { return "cards.deleted" }

// ChecklistChanged reports an item added / checked / unchecked / renamed / removed / reordered.
type ChecklistChanged struct {
	Card
	Action string
	Text   string
}

func (ChecklistChanged) EventName() string { return "cards.checklist_changed" }

// LabelsChanged reports workspace label edits (names/colours shown on many cards).
type LabelsChanged struct {
	WorkspaceID, ActorID uuid.UUID
}

func (LabelsChanged) EventName() string { return "cards.labels_changed" }
