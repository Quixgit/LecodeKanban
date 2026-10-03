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

	// Properties (pages).
	Status         Status
	Tags           []string
	LastVerifiedAt *time.Time
	// ReviewDays is how long a published page stays fresh; 0 switches the reminder off.
	ReviewDays int
	FullWidth  bool
}

func (n Node) Deleted() bool { return n.DeletedAt != nil }

// ReviewDue reports whether a published page has gone unverified for longer than its review period.
func (n Node) ReviewDue(now time.Time) bool {
	if n.Kind != KindPage || n.Status != StatusPublished || n.ReviewDays <= 0 {
		return false
	}
	since := n.CreatedAt
	if n.LastVerifiedAt != nil {
		since = *n.LastVerifiedAt
	}
	return since.AddDate(0, 0, n.ReviewDays).Before(now)
}

type Status string

const (
	StatusDraft     Status = "draft"
	StatusPublished Status = "published"
	StatusOutdated  Status = "outdated"
)

func (s Status) Valid() bool {
	return s == StatusDraft || s == StatusPublished || s == StatusOutdated
}

const (
	MaxTags         = 10
	MaxTagLen       = 30
	MaxReviewDays   = 730
	MaxFilesPerPage = 100
)

// Content is a page's document with its optimistic-locking version.
type Content struct {
	NodeID    uuid.UUID
	Doc       []byte
	Plain     string
	Version   int
	UpdatedBy *uuid.UUID
	UpdatedAt time.Time
}

// Template is a custom page layout of a workspace.
type Template struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Description string
	Icon        string
	Doc         []byte
	CreatedBy   *uuid.UUID
	CreatedAt   time.Time
}

// File is an upload embedded in a page; access follows the page.
type File struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	NodeID      uuid.UUID
	Name        string
	ContentType string
	Size        int64
	StorageKey  string
	UploadedBy  *uuid.UUID
	CreatedAt   time.Time
}

// InlineImageTypes may be shown by the browser; every other upload downloads.
var InlineImageTypes = map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true}

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
	ErrNoFile       = apperr.Define("wiki.no_file", http.StatusBadRequest)
	ErrTooManyFiles = apperr.Define("wiki.too_many_files", http.StatusUnprocessableEntity)
)
