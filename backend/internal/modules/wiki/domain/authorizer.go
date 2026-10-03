package domain

import (
	"slices"

	"github.com/google/uuid"

	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

// Role is a wiki role on an element, ordered owner > editor > commenter > viewer. The empty
// role means "no access".
type Role string

const (
	RoleOwner     Role = "owner"
	RoleEditor    Role = "editor"
	RoleCommenter Role = "commenter"
	RoleViewer    Role = "viewer"
)

func (r Role) rank() int {
	switch r {
	case RoleOwner:
		return 4
	case RoleEditor:
		return 3
	case RoleCommenter:
		return 2
	case RoleViewer:
		return 1
	}
	return 0
}

func (r Role) Valid() bool { return r.rank() > 0 }

func (r Role) AtLeast(min Role) bool { return r.rank() >= min.rank() && r.rank() > 0 }

func maxRole(a, b Role) Role {
	if b.rank() > a.rank() {
		return b
	}
	return a
}

func minRole(a, b Role) Role {
	if a.rank() <= b.rank() {
		return a
	}
	return b
}

// Capability is something a role may do to an element.
type Capability string

const (
	CapView    Capability = "view"
	CapComment Capability = "comment"
	// CapEdit covers content, rename, create children, move and (soft) delete.
	CapEdit Capability = "edit"
	// CapManage covers sharing, visibility, permanent deletion and space settings.
	CapManage Capability = "manage"
)

var capRole = map[Capability]Role{
	CapView: RoleViewer, CapComment: RoleCommenter, CapEdit: RoleEditor, CapManage: RoleOwner,
}

func (r Role) Can(c Capability) bool {
	min, ok := capRole[c]
	return ok && r.AtLeast(min)
}

// Grant is a direct grant on one element.
type Grant struct {
	Kind        PrincipalKind
	PrincipalID uuid.UUID
	Role        Role
}

// Element is one link of the chain from the space (index 0) down to the node being resolved.
type Element struct {
	ID uuid.UUID
	// Visibility is empty when the element inherits (nodes only; spaces are always explicit).
	Visibility    Visibility
	WorkspaceRole Role // what Workspace visibility allows (viewer, commenter or editor)
	OwnerID       uuid.UUID
	Grants        []Grant
}

// Subject is who is asking. WorkspaceRole is empty for non-members, who never get access.
type Subject struct {
	UserID        uuid.UUID
	Teams         []uuid.UUID
	WorkspaceRole wsdomain.Role
}

// Via explains where a role comes from.
type Via string

const (
	ViaNone      Via = "none"
	ViaOwner     Via = "owner"
	ViaGrant     Via = "grant"
	ViaWorkspace Via = "workspace"
)

// Access is the result of resolving a chain for a subject.
type Access struct {
	Role Role
	Via  Via
	// RoleSource is the element the role was taken from (zero for none).
	RoleSource uuid.UUID
	// Visibility is the effective visibility and VisibilitySource the element that sets it.
	Visibility       Visibility
	VisibilitySource uuid.UUID
}

// visibilityIndex is the nearest element at or above the end of the chain with an explicit
// visibility; the first element is always explicit.
func visibilityIndex(chain []Element) int {
	for i := len(chain) - 1; i > 0; i-- {
		if chain[i].Visibility != "" {
			return i
		}
	}
	return 0
}

// scanFrom is where grants stop being inherited: a private element is an access boundary, so
// grants of its ancestors do not reach into it. Shared and workspace elements keep them.
func scanFrom(chain []Element, vi int) int {
	if chain[vi].Visibility == Private {
		return vi
	}
	return 0
}

func (s Subject) capRole(r Role) Role {
	if s.WorkspaceRole == wsdomain.RoleViewer {
		return minRole(r, RoleViewer)
	}
	return r
}

// Resolve computes a subject's effective access on the last element of chain.
//
//  1. Effective visibility = nearest explicit visibility walking up from the node.
//  2. Explicit access: the closest element (node first, then ancestors, never above a private
//     boundary) where the subject is the owner or holds a grant (directly or through a team);
//     it overrides everything above it, in both directions.
//  3. Otherwise Workspace visibility gives every member the element's WorkspaceRole.
//  4. Non-members and workspace viewers are capped: non-members get nothing, viewers read only.
func Resolve(sub Subject, chain []Element) Access {
	if len(chain) == 0 || sub.WorkspaceRole == "" {
		return Access{Via: ViaNone}
	}
	vi := visibilityIndex(chain)
	out := Access{Via: ViaNone, Visibility: chain[vi].Visibility, VisibilitySource: chain[vi].ID}
	for i := len(chain) - 1; i >= scanFrom(chain, vi); i-- {
		el := chain[i]
		role := Role("")
		via := ViaGrant
		if el.OwnerID == sub.UserID {
			role, via = RoleOwner, ViaOwner
		}
		for _, g := range el.Grants {
			if matches(sub, g) {
				if r := maxRole(role, g.Role); r != role {
					role, via = r, ViaGrant
				}
			}
		}
		if role != "" {
			out.Role, out.Via, out.RoleSource = sub.capRole(role), via, el.ID
			return out
		}
	}
	if chain[vi].Visibility == Workspace {
		out.Role, out.Via, out.RoleSource = sub.capRole(chain[vi].WorkspaceRole), ViaWorkspace, chain[vi].ID
	}
	return out
}

func matches(sub Subject, g Grant) bool {
	switch g.Kind {
	case PrincipalUser:
		return g.PrincipalID == sub.UserID
	case PrincipalTeam:
		return slices.Contains(sub.Teams, g.PrincipalID)
	}
	return false
}

// Audience describes who can reach the last element of a chain, independent of any subject; two
// audiences are compared to warn before a move makes a page more widely readable.
type Audience struct {
	Visibility    Visibility
	WorkspaceRole Role
	principals    map[string]Role
}

func principalKey(k PrincipalKind, id uuid.UUID) string { return string(k) + ":" + id.String() }

// AudienceOf collects the visibility and every principal whose explicit access reaches the
// element (owners and grants within the inherited range).
func AudienceOf(chain []Element) Audience {
	if len(chain) == 0 {
		return Audience{}
	}
	vi := visibilityIndex(chain)
	a := Audience{Visibility: chain[vi].Visibility, principals: map[string]Role{}}
	if a.Visibility == Workspace {
		a.WorkspaceRole = chain[vi].WorkspaceRole
	}
	for i := scanFrom(chain, vi); i < len(chain); i++ {
		el := chain[i]
		k := principalKey(PrincipalUser, el.OwnerID)
		a.principals[k] = maxRole(a.principals[k], RoleOwner)
		for _, g := range el.Grants {
			k := principalKey(g.Kind, g.PrincipalID)
			a.principals[k] = maxRole(a.principals[k], g.Role)
		}
	}
	return a
}

// WidensComparedTo reports whether a lets in somebody (or a higher role) that before did not.
func (a Audience) WidensComparedTo(before Audience) bool {
	if a.Visibility.rank() > before.Visibility.rank() {
		return true
	}
	if a.Visibility == Workspace && before.Visibility == Workspace &&
		a.WorkspaceRole.rank() > before.WorkspaceRole.rank() {
		return true
	}
	for k, r := range a.principals {
		if r.rank() > before.principals[k].rank() {
			return true
		}
	}
	return false
}
