package domain

// Role is a workspace membership role, ordered owner > admin > member > viewer.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
	RoleViewer Role = "viewer"
)

func (r Role) rank() int {
	switch r {
	case RoleOwner:
		return 4
	case RoleAdmin:
		return 3
	case RoleMember:
		return 2
	case RoleViewer:
		return 1
	}
	return 0
}

func (r Role) Valid() bool { return r.rank() > 0 }

// AtLeast reports whether r grants at least the privileges of min.
func (r Role) AtLeast(min Role) bool { return r.rank() >= min.rank() }

// Permission is a workspace-scoped action.
type Permission string

const (
	PermView          Permission = "workspace.view"
	PermUpdate        Permission = "workspace.update"
	PermDelete        Permission = "workspace.delete"
	PermManageMembers Permission = "members.manage"
	PermEditContent   Permission = "content.edit" // boards, cards, comments (phase 3+)
)

var minRole = map[Permission]Role{
	PermView:          RoleViewer,
	PermEditContent:   RoleMember,
	PermUpdate:        RoleAdmin,
	PermManageMembers: RoleAdmin,
	PermDelete:        RoleOwner,
}

// Can reports whether role r holds permission p.
func (r Role) Can(p Permission) bool {
	min, ok := minRole[p]
	return ok && r.AtLeast(min)
}

// CanAssign reports whether actor may give `to` to a member currently holding `target`.
// Owners may do anything; admins may manage members/viewers and grant up to admin.
// Anyone may lower their own role. Last-owner protection is checked separately.
func CanAssign(actor, target, to Role, self bool) bool {
	if !to.Valid() || !target.Valid() {
		return false
	}
	if self && to.rank() <= target.rank() {
		return true
	}
	if actor == RoleOwner {
		return true
	}
	return actor == RoleAdmin && target.rank() < RoleAdmin.rank() && to.rank() <= RoleAdmin.rank()
}

// CanRemove reports whether actor may remove a member holding `target`. Leaving is always allowed.
func CanRemove(actor, target Role, self bool) bool {
	if self || actor == RoleOwner {
		return true
	}
	return actor == RoleAdmin && target.rank() < RoleAdmin.rank()
}

// CanInvite reports whether actor may invite someone with role `as`.
func CanInvite(actor, as Role) bool {
	return actor.Can(PermManageMembers) && as != RoleOwner && as.Valid() && as.rank() <= actor.rank()
}
