// Package domain holds the notifications model: things that happened to a person.
package domain

import (
	"time"

	"github.com/google/uuid"
)

type Kind string

const (
	Assigned      Kind = "assigned"       // put on a task
	TaskMoved     Kind = "task_moved"     // a task you work on changed column
	TaskUpdated   Kind = "task_updated"   // a task you work on was edited
	TaskCommented Kind = "task_commented" // someone wrote on a task you work on
	Mention       Kind = "mention"        // named, or reached through @channel / @here
	DM            Kind = "dm"             // a direct message
)

// Notification is one row of a person's bell. Title is the subject (a task key and title, or a
// channel name) and Body the detail (a message excerpt, the target column); clients phrase the rest.
type Notification struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	WorkspaceID uuid.UUID
	Kind        Kind
	ActorID     *uuid.UUID
	CardID      *uuid.UUID
	ProjectID   *uuid.UUID
	ChannelID   *uuid.UUID
	MessageID   *uuid.UUID
	Title       string
	Body        string
	CreatedAt   time.Time
	ReadAt      *time.Time
}

func (n Notification) Read() bool { return n.ReadAt != nil }
