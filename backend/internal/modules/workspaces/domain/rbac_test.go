package domain

import "testing"

func TestCan(t *testing.T) {
	cases := []struct {
		role Role
		perm Permission
		want bool
	}{
		{RoleViewer, PermView, true},
		{RoleViewer, PermEditContent, false},
		{RoleMember, PermEditContent, true},
		{RoleMember, PermManageMembers, false},
		{RoleAdmin, PermManageMembers, true},
		{RoleAdmin, PermUpdate, true},
		{RoleAdmin, PermDelete, false},
		{RoleMember, PermTasksDelete, true},
		{RoleMember, PermFieldsManage, false},
		{RoleAdmin, PermFieldsManage, true},
		{RoleViewer, PermProjectCreate, false},
		{RoleAdmin, PermRoles, false},
		{RoleOwner, PermRoles, true},
		{RoleOwner, PermDelete, true},
		{RoleOwner, Permission("unknown"), false},
	}
	for _, tc := range cases {
		if got := NewAccess(tc.role, RoleDefaults(tc.role), nil, "").Can(tc.perm); got != tc.want {
			t.Errorf("%s.Can(%s) = %v, want %v", tc.role, tc.perm, got, tc.want)
		}
	}
}

func TestCanAssign(t *testing.T) {
	cases := []struct {
		name              string
		actor, target, to Role
		self, want        bool
	}{
		{"owner promotes member to owner", RoleOwner, RoleMember, RoleOwner, false, true},
		{"owner demotes another owner", RoleOwner, RoleOwner, RoleAdmin, false, true},
		{"admin promotes member to admin", RoleAdmin, RoleMember, RoleAdmin, false, true},
		{"admin cannot grant owner", RoleAdmin, RoleMember, RoleOwner, false, false},
		{"admin cannot demote another admin", RoleAdmin, RoleAdmin, RoleMember, false, false},
		{"admin cannot touch owner", RoleAdmin, RoleOwner, RoleViewer, false, false},
		{"admin demotes self", RoleAdmin, RoleAdmin, RoleMember, true, true},
		{"member cannot promote self", RoleMember, RoleMember, RoleAdmin, true, false},
		{"member cannot change others", RoleMember, RoleViewer, RoleMember, false, false},
		{"viewer stays viewer", RoleViewer, RoleViewer, RoleViewer, true, true},
		{"invalid target role", RoleOwner, RoleMember, Role("boss"), false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanAssign(tc.actor, tc.target, tc.to, tc.self); got != tc.want {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}

func TestCanRemoveAndInvite(t *testing.T) {
	removeCases := []struct {
		actor, target Role
		self, want    bool
	}{
		{RoleMember, RoleMember, true, true},
		{RoleViewer, RoleOwner, false, false},
		{RoleAdmin, RoleViewer, false, true},
		{RoleAdmin, RoleAdmin, false, false},
		{RoleOwner, RoleAdmin, false, true},
	}
	for _, tc := range removeCases {
		if got := CanRemove(tc.actor, tc.target, tc.self); got != tc.want {
			t.Errorf("CanRemove(%s,%s,%v)=%v", tc.actor, tc.target, tc.self, got)
		}
	}
	inviteCases := []struct {
		actor, as Role
		want      bool
	}{
		{RoleOwner, RoleAdmin, true},
		{RoleAdmin, RoleAdmin, true},
		{RoleAdmin, RoleViewer, true},
		{RoleMember, RoleViewer, false},
		{RoleOwner, RoleOwner, false},
	}
	for _, tc := range inviteCases {
		if got := CanInvite(NewAccess(tc.actor, RoleDefaults(tc.actor), nil, ""), tc.as); got != tc.want {
			t.Errorf("CanInvite(%s,%s)=%v", tc.actor, tc.as, got)
		}
	}
}

func TestAccessAndClean(t *testing.T) {
	// A custom role with a hand-picked set; "view" is always there.
	a := NewAccess(RoleMember, []Permission{PermEditContent, PermFieldsManage}, nil, "Designer")
	if !a.Can(PermView) || !a.Can(PermFieldsManage) || a.Can(PermProjectCreate) {
		t.Fatalf("custom role: %v", a.Permissions())
	}
	// The owner always holds everything, even if a stored set says otherwise.
	o := NewAccess(RoleOwner, []Permission{PermView}, nil, "")
	if !o.Can(PermDelete) || !o.Can(PermRoles) {
		t.Fatal("owner must hold every permission")
	}
	kept, dropped := Clean([]Permission{PermTasksDelete, PermEditContent, "nope", PermDelete, PermEditContent})
	if len(dropped) != 2 || kept[0] != PermView || kept[1] != PermEditContent || kept[2] != PermTasksDelete || len(kept) != 3 {
		t.Fatalf("clean: kept %v dropped %v", kept, dropped)
	}
	// Every default is a known permission, and a viewer can only look.
	for _, r := range []Role{RoleOwner, RoleAdmin, RoleMember, RoleViewer} {
		for _, p := range RoleDefaults(r) {
			if !p.Valid() {
				t.Fatalf("%s default %s is not in the catalog", r, p)
			}
		}
	}
	if len(RoleDefaults(RoleViewer)) != 1 {
		t.Fatal("viewers only look by default")
	}
}
