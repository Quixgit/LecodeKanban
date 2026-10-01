// Package events declares events published by the projects module.
package events

import "github.com/google/uuid"

type ProjectCreated struct {
	ProjectID, WorkspaceID uuid.UUID
}

func (ProjectCreated) EventName() string { return "projects.created" }

type ProjectUpdated struct {
	ProjectID, WorkspaceID uuid.UUID
}

func (ProjectUpdated) EventName() string { return "projects.updated" }

type ProjectArchived struct {
	ProjectID, WorkspaceID uuid.UUID
}

func (ProjectArchived) EventName() string { return "projects.archived" }
