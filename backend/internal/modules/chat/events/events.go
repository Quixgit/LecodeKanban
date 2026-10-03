// Package events declares events published by the chat module (consumed by notifications).
package events

import "github.com/google/uuid"

// MessagePosted reports a new message with the people it is addressed to, so the bell can ring for
// them without reading chat tables.
type MessagePosted struct {
	WorkspaceID, ChannelID, MessageID, AuthorID uuid.UUID
	// ChannelKind is public, private, dm, project or card; RefID is the project or card of a
	// scoped conversation.
	ChannelKind string
	ChannelName string
	RefID       *uuid.UUID
	Excerpt     string
	// Mentioned were named, or reached through @channel / @here; Direct are the other people in a
	// direct message. Both exclude the author.
	Mentioned []uuid.UUID
	Direct    []uuid.UUID
}

func (MessagePosted) EventName() string { return "chat.message_posted" }
