// Package domain holds the wiki entities: spaces, a tree of folders and pages, grants and the
// pure access-resolution rules (authorizer.go). Decisions: docs/adr/0014-wiki-module.md.
package domain

import (
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Kind string

const (
	KindFolder Kind = "folder"
	KindPage   Kind = "page"
)

func (k Kind) Valid() bool { return k == KindFolder || k == KindPage }

// Visibility says who can reach an element besides explicit grants.
type Visibility string

const (
	// Private: only the element's owner and people invited to it (or below).
	Private Visibility = "private"
	// Shared: only owners and people with a grant (grants of ancestors apply).
	Shared Visibility = "shared"
	// Workspace: every workspace member, with WorkspaceRole.
	Workspace Visibility = "workspace"
)

func (v Visibility) Valid() bool { return v == Private || v == Shared || v == Workspace }

func (v Visibility) rank() int {
	switch v {
	case Private:
		return 1
	case Shared:
		return 2
	case Workspace:
		return 3
	}
	return 0
}

type PrincipalKind string

const (
	PrincipalUser PrincipalKind = "user"
	PrincipalTeam PrincipalKind = "team"
)

func (k PrincipalKind) Valid() bool { return k == PrincipalUser || k == PrincipalTeam }

const (
	// TrashRetention is how long soft-deleted nodes stay restorable.
	TrashRetention  = 30 * 24 * time.Hour
	DefaultMaxDepth = 12
	MaxTitle        = 200
	MaxSpaceName    = 80
	MaxPage         = 100
)

type Space struct {
	ID            uuid.UUID
	WorkspaceID   uuid.UUID
	OwnerID       uuid.UUID
	Name          string
	Icon          string
	Color         string
	Description   string
	Visibility    Visibility
	WorkspaceRole Role
	MaxDepth      int
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type Node struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	SpaceID     uuid.UUID
	ParentID    *uuid.UUID
	Kind        Kind
	Title       string
	Icon        string
	Cover       string
	Rank        string
	Depth       int
	Path        string
	// Visibility is empty when the node inherits.
	Visibility    Visibility
	WorkspaceRole Role
	OwnerID       uuid.UUID
	CreatedBy     uuid.UUID
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     *time.Time
	DeletedBy     *uuid.UUID
	TrashRootID   *uuid.UUID
}

func (n Node) Deleted() bool { return n.DeletedAt != nil }

// Permission is a direct grant on a space (NodeID nil) or a node.
type Permission struct {
	ID            uuid.UUID
	WorkspaceID   uuid.UUID
	SpaceID       uuid.UUID
	NodeID        *uuid.UUID
	PrincipalKind PrincipalKind
	PrincipalID   uuid.UUID
	Role          Role
	CreatedBy     *uuid.UUID
	CreatedAt     time.Time
}

// AuditEvent kinds (translated by the frontend).
const (
	AuditSpaceCreated      = "space.created"
	AuditSpaceUpdated      = "space.updated"
	AuditSpaceDeleted      = "space.deleted"
	AuditNodeCreated       = "node.created"
	AuditNodeRenamed       = "node.renamed"
	AuditNodeMoved         = "node.moved"
	AuditNodeDeleted       = "node.deleted"
	AuditNodeRestored      = "node.restored"
	AuditNodePurged        = "node.purged"
	AuditVisibilityChanged = "visibility.changed"
	AuditPermissionGranted = "permission.granted"
	AuditPermissionChanged = "permission.changed"
	AuditPermissionRevoked = "permission.revoked"
)

type AuditEvent struct {
	ID          int64
	WorkspaceID uuid.UUID
	SpaceID     *uuid.UUID
	NodeID      *uuid.UUID
	ActorID     *uuid.UUID
	Kind        string
	Data        map[string]any
	At          time.Time
}

var (
	// ErrNotFound is also returned for elements the caller may not know exist.
	ErrNotFound     = apperr.Define("wiki.not_found", http.StatusNotFound)
	ErrForbidden    = apperr.Define("wiki.forbidden", http.StatusForbidden)
	ErrMaxDepth     = apperr.Define("wiki.max_depth", http.StatusUnprocessableEntity)
	ErrCycle        = apperr.Define("wiki.move_into_self", http.StatusUnprocessableEntity)
	ErrConfirmWiden = apperr.Define("wiki.confirm_widening", http.StatusConflict)
	ErrNotTrashed   = apperr.Define("wiki.not_in_trash", http.StatusConflict)
	ErrBadPlacement = apperr.Define("wiki.bad_placement", http.StatusUnprocessableEntity)
)
