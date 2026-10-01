// Package events declares events published by the attachments module.
package events

import "github.com/google/uuid"

type Attachment struct {
	AttachmentID, CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
	CardNumber                                            int
	CardTitle, Name                                       string
	Count                                                 int // the card's attachment total after the change
}

type AttachmentAdded struct{ Attachment }

func (AttachmentAdded) EventName() string { return "attachments.added" }

type AttachmentRemoved struct{ Attachment }

func (AttachmentRemoved) EventName() string { return "attachments.removed" }
