// Package events declares events published by the workspaces module.
package events

import "github.com/google/uuid"

type MemberJoined struct {
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
	Role        string
}

func (MemberJoined) EventName() string { return "workspaces.member_joined" }

type MemberRemoved struct {
	WorkspaceID uuid.UUID
	UserID      uuid.UUID
}

func (MemberRemoved) EventName() string { return "workspaces.member_removed" }
