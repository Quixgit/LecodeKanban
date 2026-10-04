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

// CanInvite reports whether the person may invite someone with role `as`: they need the invite
// permission and cannot hand out more than their own role.
func CanInvite(actor Access, as Role) bool {
	return actor.Can(PermInvite) && as != RoleOwner && as.Valid() && as.rank() <= actor.Role.rank()
}
