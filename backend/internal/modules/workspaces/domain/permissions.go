package domain

import (
	"slices"

	"github.com/google/uuid"
)

// Permission is one thing a person may do in a workspace. Roles are sets of permissions: the four built-in
// roles have defaults that each workspace can change, and workspaces can define custom roles.
type Permission string

const (
	PermView          Permission = "workspace.view"
	PermEditContent   Permission = "content.edit" // create and edit tasks, comments, checklists, attachments
	PermTasksDelete   Permission = "tasks.delete"
	PermModerate      Permission = "content.moderate" // delete other people's comments and attachments
	PermProjectCreate Permission = "projects.create"
	PermProjectEdit   Permission = "projects.edit"
	PermProjectDelete Permission = "projects.delete" // archive and delete projects
	PermBoardsManage  Permission = "boards.manage"   // columns and their order
	PermLabelsManage  Permission = "labels.manage"
	PermFieldsManage  Permission = "fields.manage" // custom field definitions
	PermChannelCreate Permission = "chat.channels.create"
	PermBroadcast     Permission = "chat.broadcast" // @channel
	PermChatModerate  Permission = "chat.moderate"  // delete others' messages, archive channels
	PermTimeManage    Permission = "time.manage"    // edit other people's time entries
	PermIntegrations  Permission = "integrations.manage"
	PermInvite        Permission = "members.invite"
	PermManageMembers Permission = "members.manage" // change roles, remove people
	PermUpdate        Permission = "workspace.update"
	PermAudit         Permission = "audit.view"
	PermExport        Permission = "data.export"    // download the workspace's tasks as a spreadsheet
	PermAnalytics     Permission = "analytics.view" // the Performance page: how the team works
	PermRoles         Permission = "roles.manage"
	PermDelete        Permission = "workspace.delete"
)

// PermInfo describes a permission in the catalog shown to administrators.
type PermInfo struct {
	Key   Permission
	Group string
	// Fixed permissions belong to the owner alone and cannot be given to other roles.
	Fixed bool
}

// Catalog lists every permission, in the order and groups the roles screen shows them.
var Catalog = []PermInfo{
	{PermView, "general", false},
	{PermEditContent, "tasks", false},
	{PermTasksDelete, "tasks", false},
	{PermModerate, "tasks", false},
	{PermProjectCreate, "projects", false},
	{PermProjectEdit, "projects", false},
	{PermProjectDelete, "projects", false},
	{PermBoardsManage, "projects", false},
	{PermLabelsManage, "projects", false},
	{PermFieldsManage, "projects", false},
	{PermChannelCreate, "chat", false},
	{PermBroadcast, "chat", false},
	{PermChatModerate, "chat", false},
	{PermTimeManage, "time", false},
	{PermIntegrations, "admin", false},
	{PermInvite, "people", false},
	{PermManageMembers, "people", false},
	{PermUpdate, "admin", false},
	{PermAudit, "admin", false},
	{PermExport, "admin", false},
	{PermAnalytics, "admin", false},
	{PermRoles, "admin", false},
	{PermDelete, "admin", true},
}

// Valid reports whether p is a known permission.
func (p Permission) Valid() bool {
	return slices.ContainsFunc(Catalog, func(i PermInfo) bool { return i.Key == p })
}

// RoleDefaults are the permissions each built-in role starts with in a new workspace.
func RoleDefaults(r Role) []Permission {
	member := []Permission{PermView, PermEditContent, PermTasksDelete, PermProjectCreate, PermProjectEdit, PermBoardsManage,
		PermLabelsManage, PermChannelCreate, PermBroadcast}
	switch r {
	case RoleOwner:
		all := make([]Permission, len(Catalog))
		for i, c := range Catalog {
			all[i] = c.Key
		}
		return all
	case RoleAdmin:
		return append(slices.Clone(member), PermModerate, PermProjectDelete, PermFieldsManage, PermChatModerate, PermTimeManage,
			PermIntegrations, PermInvite, PermManageMembers, PermUpdate, PermAudit, PermExport, PermAnalytics)
	case RoleMember:
		return member
	case RoleViewer:
		return []Permission{PermView}
	}
	return nil
}

// Access is what a person may do in one workspace: their role (which decides the hierarchy of who may
// change whom) and the permissions of that role, or of the custom role they were given.
type Access struct {
	Role         Role
	CustomRoleID *uuid.UUID
	CustomName   string
	perms        map[Permission]bool
}

// NewAccess builds an Access. The owner always holds every permission, whatever is stored.
func NewAccess(role Role, perms []Permission, custom *uuid.UUID, customName string) Access {
	if role == RoleOwner {
		perms = RoleDefaults(RoleOwner)
	}
	m := make(map[Permission]bool, len(perms)+1)
	for _, p := range perms {
		m[p] = true
	}
	m[PermView] = m[PermView] || role.Valid() // everyone in the workspace can look
	return Access{Role: role, CustomRoleID: custom, CustomName: customName, perms: m}
}

// Can reports whether the person holds permission p.
func (a Access) Can(p Permission) bool { return a.perms[p] }

// AtLeast reports whether the person's role ranks at least as high as min.
func (a Access) AtLeast(min Role) bool { return a.Role.AtLeast(min) }

// Permissions lists what the person may do, in catalog order.
func (a Access) Permissions() []Permission {
	out := []Permission{}
	for _, c := range Catalog {
		if a.perms[c.Key] {
			out = append(out, c.Key)
		}
	}
	return out
}

// Clean keeps known, assignable permissions in catalog order, always including "view". It reports
// the permissions it dropped because they are unknown or reserved for the owner.
func Clean(in []Permission) (kept []Permission, dropped []Permission) {
	want := map[Permission]bool{PermView: true}
	for _, p := range in {
		switch {
		case !p.Valid():
			dropped = append(dropped, p)
		default:
			info := Catalog[slices.IndexFunc(Catalog, func(i PermInfo) bool { return i.Key == p })]
			if info.Fixed {
				dropped = append(dropped, p)
				continue
			}
			want[p] = true
		}
	}
	for _, c := range Catalog {
		if want[c.Key] {
			kept = append(kept, c.Key)
		}
	}
	return kept, dropped
}

// CustomRole is a role a workspace defined itself.
type CustomRole struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Description string
	// Base is the built-in role it ranks as (admin, member or viewer).
	Base        Role
	Permissions []Permission
	Members     int
}
