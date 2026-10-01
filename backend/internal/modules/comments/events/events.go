// Package events declares events published by the comments module (consumed by cards for the
// comment counter, activity, realtime and — in phase 8 — notifications for @mentions).
package events

import "github.com/google/uuid"

type Comment struct {
	CommentID, CardID, ProjectID, WorkspaceID, ActorID uuid.UUID
	CardNumber                                         int
	CardTitle                                          string
	// Count is the card's comment total after the change.
	Count int
}

type CommentCreated struct {
	Comment
	Excerpt  string
	Mentions []uuid.UUID
}

func (CommentCreated) EventName() string { return "comments.created" }

type CommentUpdated struct {
	Comment
	NewMentions []uuid.UUID // mentioned for the first time by this edit
}

func (CommentUpdated) EventName() string { return "comments.updated" }

type CommentDeleted struct {
	Comment
}

func (CommentDeleted) EventName() string { return "comments.deleted" }
