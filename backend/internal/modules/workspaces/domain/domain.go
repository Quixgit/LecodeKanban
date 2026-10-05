// Package domain holds workspace entities, roles and the RBAC policy.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Workspace struct {
	ID          uuid.UUID
	Name        string
	Slug        string
	Role        Role // the caller's role
	MemberCount int
	CreatedAt   time.Time
	// Permissions and CustomRole describe what the caller may do here.
	Permissions []Permission
	CustomRole  *RoleRef
	// TwoFactorBlocked: the workspace requires two-step verification and the caller has not turned it on.
	TwoFactorBlocked bool
}

// RoleRef names a custom role.
type RoleRef struct {
	ID   uuid.UUID
	Name string
}

type Member struct {
	UserID     uuid.UUID
	Name       string
	Email      string
	Avatar     *string
	JobTitle   string
	Role       Role
	JoinedAt   time.Time
	CustomRole *RoleRef
}

type Invite struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Email       string
	Role        Role
	InvitedBy   *uuid.UUID
	ExpiresAt   time.Time
	AcceptedAt  *time.Time
	CreatedAt   time.Time
	// Link is the invitation address; it is known only when the invitation is created.
	Link string
}

type InvitePreview struct {
	WorkspaceName string
	InviterName   *string
	Email         string
	Role          Role
	Expired       bool
	Accepted      bool
}

var (
	ErrNotFound         = apperr.Define("workspaces.not_found", http.StatusNotFound)
	ErrMemberNotFound   = apperr.Define("workspaces.member_not_found", http.StatusNotFound)
	ErrLastOwner        = apperr.Define("workspaces.last_owner", http.StatusConflict)
	ErrAlreadyMember    = apperr.Define("workspaces.already_member", http.StatusConflict)
	ErrInviteNotFound   = apperr.Define("workspaces.invite_not_found", http.StatusNotFound)
	ErrInviteExpired    = apperr.Define("workspaces.invite_expired", http.StatusGone)
	ErrInviteMismatch   = apperr.Define("workspaces.invite_email_mismatch", http.StatusForbidden)
	ErrInsufficientRole = apperr.Define("workspaces.insufficient_role", http.StatusForbidden)
)
