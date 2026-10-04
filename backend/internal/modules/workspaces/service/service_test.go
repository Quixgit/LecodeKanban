package service_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

type env struct {
	svc   *service.Service
	users *userssvc.Service
	mails []mailer.Message
}

func setup(t *testing.T) *env {
	t.Helper()
	tdb.Reset(t)
	bus := eventbus.New()
	e := &env{users: userssvc.New(usersrepo.New(tdb.Pool), bus)}
	e.svc = service.New(repository.New(tdb.Pool), e.users, bus,
		func(_ context.Context, m mailer.Message, _ string) error { e.mails = append(e.mails, m); return nil },
		"http://app.test")
	return e
}

func (e *env) user(t *testing.T, name, email string, locale usersdomain.Locale) uuid.UUID {
	t.Helper()
	u, err := e.users.Create(context.Background(), usersdomain.NewUser{Email: email, Name: name, Locale: locale})
	if err != nil {
		t.Fatal(err)
	}
	return u.ID
}

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

var inviteRE = regexp.MustCompile(`/invite/([A-Za-z0-9_-]+)`)

func (e *env) inviteToken(t *testing.T) string {
	t.Helper()
	m := inviteRE.FindStringSubmatch(e.mails[len(e.mails)-1].Text)
	if m == nil {
		t.Fatal("no invite link in email")
	}
	return m[1]
}

func TestPersonalWorkspaceProvisioning(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	uk := e.user(t, "Олена Коваль", "olena@example.com", usersdomain.LocaleUK)
	list, err := e.svc.List(ctx, uk)
	if err != nil || len(list) != 1 || list[0].Name != "Простір Олена" || list[0].Role != domain.RoleOwner {
		t.Fatalf("unexpected %+v %v", list, err)
	}
	if err := e.svc.EnsurePersonal(ctx, uk); err != nil {
		t.Fatal(err)
	}
	if again, _ := e.svc.List(ctx, uk); len(again) != 1 {
		t.Fatal("EnsurePersonal must be idempotent")
	}
	en := e.user(t, "Peter Gabrielle", "peter@example.com", usersdomain.LocaleEN)
	list, _ = e.svc.List(ctx, en)
	if list[0].Name != "Peter's workspace" || list[0].Slug == "" {
		t.Fatalf("unexpected %+v", list[0])
	}
}

func TestCreateRenameDeleteAndIsolation(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "o@example.com", "en")
	stranger := e.user(t, "Stranger", "s@example.com", "en")

	_, err := e.svc.Create(ctx, owner, "  ")
	mustCode(t, err, apperr.Validation)
	ws, err := e.svc.Create(ctx, owner, "Платформа Core")
	if err != nil || ws.Role != domain.RoleOwner || ws.MemberCount != 1 {
		t.Fatalf("create: %+v %v", ws, err)
	}

	// Non-members cannot even learn that the workspace exists.
	_, err = e.svc.Get(ctx, stranger, ws.ID)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.Members(ctx, stranger, ws.ID)
	mustCode(t, err, domain.ErrNotFound)

	renamed, err := e.svc.Rename(ctx, owner, ws.ID, "Core Platform")
	if err != nil || renamed.Name != "Core Platform" {
		t.Fatalf("rename: %v", err)
	}
	if err := e.svc.Delete(ctx, owner, ws.ID); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Get(ctx, owner, ws.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestInviteAcceptAndRoles(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "uk")
	ws, _ := e.svc.Create(ctx, owner, "Team")

	_, err := e.svc.Invite(ctx, owner, ws.ID, "bad", domain.RoleMember)
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.Invite(ctx, owner, ws.ID, "x@example.com", domain.RoleOwner)
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.Invite(ctx, owner, ws.ID, "owner@example.com", domain.RoleMember)
	mustCode(t, err, domain.ErrAlreadyMember)

	inv, err := e.svc.Invite(ctx, owner, ws.ID, "Admin@Example.com", domain.RoleAdmin)
	if err != nil || inv.Email != "admin@example.com" {
		t.Fatalf("invite: %+v %v", inv, err)
	}
	if e.mails[len(e.mails)-1].Subject != "Owner запрошує вас до Team у LecodeKanban" {
		t.Fatalf("invite email should use inviter's locale: %q", e.mails[len(e.mails)-1].Subject)
	}
	tok := e.inviteToken(t)

	p, err := e.svc.Preview(ctx, tok)
	if err != nil || p.WorkspaceName != "Team" || p.InviterName == nil || *p.InviterName != "Owner" || p.Expired || p.Accepted {
		t.Fatalf("preview: %+v %v", p, err)
	}
	_, err = e.svc.Preview(ctx, "nope")
	mustCode(t, err, domain.ErrInviteNotFound)

	wrong := e.user(t, "Mallory", "mallory@example.com", "en")
	_, err = e.svc.Accept(ctx, wrong, tok)
	mustCode(t, err, domain.ErrInviteMismatch)

	admin := e.user(t, "Admin", "admin@example.com", "en")
	joined, err := e.svc.Accept(ctx, admin, tok)
	if err != nil || joined.Role != domain.RoleAdmin || joined.MemberCount != 2 {
		t.Fatalf("accept: %+v %v", joined, err)
	}
	_, err = e.svc.Accept(ctx, admin, tok)
	mustCode(t, err, domain.ErrInviteNotFound) // single use

	// Admin invites a member; member cannot invite.
	if _, err := e.svc.Invite(ctx, admin, ws.ID, "member@example.com", domain.RoleMember); err != nil {
		t.Fatal(err)
	}
	member := e.user(t, "Member", "member@example.com", "en")
	if _, err := e.svc.Accept(ctx, member, e.inviteToken(t)); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Invite(ctx, member, ws.ID, "z@example.com", domain.RoleViewer)
	mustCode(t, err, domain.ErrInsufficientRole)
	_, err = e.svc.Invites(ctx, member, ws.ID)
	mustCode(t, err, domain.ErrInsufficientRole)

	members, err := e.svc.Members(ctx, member, ws.ID)
	if err != nil || len(members) != 3 || members[0].Name != "Owner" {
		t.Fatalf("members: %+v %v", members, err)
	}

	// Role changes follow the policy.
	mustCode(t, e.svc.ChangeRole(ctx, admin, ws.ID, owner, domain.RoleViewer), domain.ErrInsufficientRole)
	mustCode(t, e.svc.ChangeRole(ctx, member, ws.ID, member, domain.RoleAdmin), domain.ErrInsufficientRole)
	mustCode(t, e.svc.ChangeRole(ctx, admin, ws.ID, member, domain.RoleOwner), domain.ErrInsufficientRole)
	if err := e.svc.ChangeRole(ctx, admin, ws.ID, member, domain.RoleViewer); err != nil {
		t.Fatal(err)
	}
	mustCode(t, e.svc.ChangeRole(ctx, owner, ws.ID, owner, domain.RoleAdmin), domain.ErrLastOwner)
	mustCode(t, e.svc.ChangeRole(ctx, owner, ws.ID, member, domain.Role("boss")), apperr.Validation)
	mustCode(t, e.svc.ChangeRole(ctx, owner, ws.ID, uuid.New(), domain.RoleViewer), domain.ErrMemberNotFound)

	// Removal: last owner cannot leave; ownership transfer then leave works.
	mustCode(t, e.svc.RemoveMember(ctx, owner, ws.ID, owner), domain.ErrLastOwner)
	mustCode(t, e.svc.RemoveMember(ctx, member, ws.ID, admin), domain.ErrInsufficientRole)
	if err := e.svc.ChangeRole(ctx, owner, ws.ID, admin, domain.RoleOwner); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.RemoveMember(ctx, owner, ws.ID, owner); err != nil {
		t.Fatalf("former sole owner should be able to leave now: %v", err)
	}
	if err := e.svc.RemoveMember(ctx, member, ws.ID, member); err != nil {
		t.Fatalf("members can leave: %v", err)
	}
	_, err = e.svc.Get(ctx, member, ws.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestInviteRevokeAndExpiry(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "en")
	ws, _ := e.svc.Create(ctx, owner, "Team")

	first, _ := e.svc.Invite(ctx, owner, ws.ID, "late@example.com", domain.RoleMember)
	firstTok := e.inviteToken(t)
	second, _ := e.svc.Invite(ctx, owner, ws.ID, "late@example.com", domain.RoleViewer)
	open, _ := e.svc.Invites(ctx, owner, ws.ID)
	if len(open) != 1 || open[0].ID != second.ID {
		t.Fatalf("re-invite must replace the open invite: %+v", open)
	}
	_, err := e.svc.Preview(ctx, firstTok)
	mustCode(t, err, domain.ErrInviteNotFound)
	mustCode(t, e.svc.RevokeInvite(ctx, owner, ws.ID, first.ID), domain.ErrInviteNotFound)

	tok := e.inviteToken(t)
	if _, err := tdb.Pool.Exec(ctx, `UPDATE workspace_invites SET expires_at = $1`, time.Now().Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	late := e.user(t, "Late", "late@example.com", "en")
	_, err = e.svc.Accept(ctx, late, tok)
	mustCode(t, err, domain.ErrInviteExpired)
	if p, _ := e.svc.Preview(ctx, tok); !p.Expired {
		t.Fatal("preview should report expiry")
	}
	if err := e.svc.RevokeInvite(ctx, owner, ws.ID, second.ID); err != nil {
		t.Fatal(err)
	}
}

func TestAuthorizeForOtherModules(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "en")
	ws, _ := e.svc.Create(ctx, owner, "Team")
	if role, err := e.svc.Authorize(ctx, ws.ID, owner, domain.PermEditContent); err != nil || role.Role != domain.RoleOwner {
		t.Fatalf("authorize: %v %v", role, err)
	}
	_, err := e.svc.Authorize(ctx, ws.ID, uuid.New(), domain.PermView)
	mustCode(t, err, domain.ErrNotFound)
}

func ptr[T any](v T) *T { return &v }

func TestSettingsAndPolicies(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "en")
	member := e.user(t, "Member", "member@example.com", "en")
	ws, _ := e.svc.Create(ctx, owner, "Team")
	inv, err := e.svc.Invite(ctx, owner, ws.ID, "member@example.com", domain.RoleMember)
	if err != nil {
		t.Fatal(err)
	}
	_ = inv
	if _, err := e.svc.Accept(ctx, member, e.inviteToken(t)); err != nil {
		t.Fatal(err)
	}

	// Everyone sees the settings; they start with the defaults.
	got, err := e.svc.Settings(ctx, member, ws.ID)
	if err != nil || got.InviteDays != 7 || !got.Features.Chat || got.WeekStart != 1 {
		t.Fatalf("defaults: %+v %v", got, err)
	}
	// Only administrators change them, and bad values are refused.
	_, err = e.svc.UpdateSettings(ctx, member, ws.ID, domain.SettingsPatch{InviteDays: ptr(5)})
	mustCode(t, err, domain.ErrInsufficientRole)
	_, err = e.svc.UpdateSettings(ctx, owner, ws.ID, domain.SettingsPatch{DefaultPriority: ptr("urgent"), InviteDays: ptr(99),
		AllowedDomains: ptr([]string{"not a domain"})})
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.Settings(ctx, uuid.New(), ws.ID)
	mustCode(t, err, domain.ErrNotFound)

	// Members cannot invite until their role is given the permission; roles never grow past their own.
	_, err = e.svc.Invite(ctx, member, ws.ID, "new1@example.com", domain.RoleViewer)
	mustCode(t, err, domain.ErrInsufficientRole)
	if err := e.svc.SetRolePermissions(ctx, owner, ws.ID, domain.RoleMember, append(domain.RoleDefaults(domain.RoleMember), domain.PermInvite)); err != nil {
		t.Fatal(err)
	}
	upd, err := e.svc.UpdateSettings(ctx, owner, ws.ID, domain.SettingsPatch{InviteDays: ptr(3),
		AllowedDomains: ptr([]string{" @Example.com ", "example.com"})})
	if err != nil || len(upd.AllowedDomains) != 1 || upd.AllowedDomains[0] != "example.com" {
		t.Fatalf("update: %+v %v", upd, err)
	}
	if _, err := e.svc.Invite(ctx, member, ws.ID, "new1@example.com", domain.RoleViewer); err != nil {
		t.Fatalf("members may invite now: %v", err)
	}
	_, err = e.svc.Invite(ctx, member, ws.ID, "new2@example.com", domain.RoleAdmin)
	mustCode(t, err, domain.ErrInsufficientRole) // never above their own role
	_, err = e.svc.Invite(ctx, owner, ws.ID, "stranger@elsewhere.org", domain.RoleMember)
	mustCode(t, err, domain.ErrDomainNotAllowed)
	invites, _ := e.svc.Invites(ctx, owner, ws.ID)
	for _, in := range invites {
		if in.Email == "new1@example.com" && in.ExpiresAt.After(time.Now().Add(4*24*time.Hour)) {
			t.Fatalf("invitation should last 3 days, expires %v", in.ExpiresAt)
		}
	}

	// An unchanged patch writes nothing; changes are listed in the audit log with who did them.
	if _, err := e.svc.UpdateSettings(ctx, owner, ws.ID, domain.SettingsPatch{InviteDays: ptr(3)}); err != nil {
		t.Fatal(err)
	}
	log, err := e.svc.Audit(ctx, owner, ws.ID)
	if err != nil {
		t.Fatal(err)
	}
	var updates, invitesSent int
	for _, en := range log {
		switch en.Action {
		case "settings.updated":
			updates++
			if en.Actor == nil || en.Actor.ID != owner {
				t.Fatalf("actor missing: %+v", en)
			}
		case "invite.sent":
			invitesSent++
		}
	}
	if updates != 1 || invitesSent < 2 {
		t.Fatalf("audit: %d updates, %d invites in %+v", updates, invitesSent, log)
	}
	_, err = e.svc.Audit(ctx, member, ws.ID)
	mustCode(t, err, domain.ErrInsufficientRole)
}

func TestMemberProfile(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "en")
	outsider := e.user(t, "Outsider", "out@example.com", "en")
	ws, _ := e.svc.Create(ctx, owner, "Team")
	title := "Designer"
	if _, err := e.users.UpdateProfile(ctx, owner, usersdomain.ProfilePatch{JobTitle: &title}); err != nil {
		t.Fatal(err)
	}
	p, err := e.svc.MemberProfile(ctx, owner, ws.ID, owner)
	if err != nil || p.User.JobTitle != "Designer" || p.Role != domain.RoleOwner {
		t.Fatalf("own card: %+v %v", p, err)
	}
	// Outsiders see nothing, and a person who is not in the workspace has no card in it.
	_, err = e.svc.MemberProfile(ctx, outsider, ws.ID, owner)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.MemberProfile(ctx, owner, ws.ID, outsider)
	mustCode(t, err, domain.ErrMemberNotFound)
}

func TestRolesAndPermissions(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	owner := e.user(t, "Owner", "owner@example.com", "en")
	anna := e.user(t, "Anna", "anna@example.com", "en")
	ben := e.user(t, "Ben", "ben@example.com", "en")
	vera := e.user(t, "Vera", "vera@example.com", "en")
	ws, _ := e.svc.Create(ctx, owner, "Team")
	join := func(u uuid.UUID, email string, role domain.Role) {
		if _, err := e.svc.Invite(ctx, owner, ws.ID, email, role); err != nil {
			t.Fatal(err)
		}
		if _, err := e.svc.Accept(ctx, u, e.inviteToken(t)); err != nil {
			t.Fatal(err)
		}
	}
	join(anna, "anna@example.com", domain.RoleAdmin)
	join(ben, "ben@example.com", domain.RoleMember)
	join(vera, "vera@example.com", domain.RoleViewer)

	// Built-in defaults: a member edits and deletes tasks but cannot manage fields; an admin can.
	can := func(u uuid.UUID, p domain.Permission) bool {
		_, err := e.svc.Authorize(ctx, ws.ID, u, p)
		return err == nil
	}
	if !can(ben, domain.PermTasksDelete) || can(ben, domain.PermFieldsManage) || !can(anna, domain.PermFieldsManage) || can(vera, domain.PermEditContent) {
		t.Fatal("defaults are not as documented")
	}

	// Only people with "manage roles" (the owner by default) change roles.
	mustCode(t, e.svc.SetRolePermissions(ctx, anna, ws.ID, domain.RoleMember, domain.RoleDefaults(domain.RoleViewer)), domain.ErrInsufficientRole)
	// The owner's role is fixed.
	mustCode(t, e.svc.SetRolePermissions(ctx, owner, ws.ID, domain.RoleOwner, nil), domain.ErrRoleLocked)

	// Taking a permission from the member role applies to every member at once, and can be reset.
	var keep []domain.Permission
	for _, p := range domain.RoleDefaults(domain.RoleMember) {
		if p != domain.PermTasksDelete {
			keep = append(keep, p)
		}
	}
	if err := e.svc.SetRolePermissions(ctx, owner, ws.ID, domain.RoleMember, keep); err != nil {
		t.Fatal(err)
	}
	if can(ben, domain.PermTasksDelete) || !can(ben, domain.PermEditContent) || !can(ben, domain.PermView) {
		t.Fatal("the member role should have lost only task deletion")
	}
	o, err := e.svc.Roles(ctx, vera, ws.ID)
	if err != nil {
		t.Fatal(err)
	}
	var memberRole service.RoleView
	for _, r := range o.Roles {
		if r.Key == "member" {
			memberRole = r
		}
	}
	if !memberRole.Changed || memberRole.Members != 1 || len(o.Catalog) < 15 {
		t.Fatalf("overview: %+v", memberRole)
	}
	if err := e.svc.ResetRole(ctx, owner, ws.ID, domain.RoleMember); err != nil || !can(ben, domain.PermTasksDelete) {
		t.Fatalf("reset: %v", err)
	}

	// A custom role: name rules, unknown permissions, escalation and the ranking base.
	_, err = e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "Admin", Base: domain.RoleMember})
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "X", Base: domain.RoleMember, Permissions: []domain.Permission{"made.up"}})
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "X", Base: domain.RoleMember, Permissions: []domain.Permission{domain.PermDelete}})
	mustCode(t, err, apperr.Validation) // deleting the workspace belongs to the owner alone
	designer, err := e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "Designer", Base: domain.RoleMember,
		Permissions: []domain.Permission{domain.PermEditContent, domain.PermFieldsManage, domain.PermLabelsManage}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "designer", Base: domain.RoleMember})
	mustCode(t, err, domain.ErrRoleNameTaken)

	// Giving it to Ben: he gets exactly its permissions, and shows up with its name.
	if err := e.svc.AssignCustomRole(ctx, owner, ws.ID, ben, &designer.ID); err != nil {
		t.Fatal(err)
	}
	if !can(ben, domain.PermFieldsManage) || can(ben, domain.PermProjectCreate) || !can(ben, domain.PermView) {
		t.Fatal("Ben should hold only the custom role's permissions")
	}
	members, _ := e.svc.Members(ctx, owner, ws.ID)
	for _, m := range members {
		if m.UserID == ben && (m.CustomRole == nil || m.CustomRole.Name != "Designer" || m.Role != domain.RoleMember) {
			t.Fatalf("member: %+v", m)
		}
	}
	list, _ := e.svc.List(ctx, ben)
	if len(list) == 0 || list[0].CustomRole == nil || len(list[0].Permissions) != 4 {
		t.Fatalf("what Ben sees of himself: %+v", list)
	}

	// Nobody changes their own role, and nobody hands out permissions they lack.
	mustCode(t, e.svc.AssignCustomRole(ctx, ben, ws.ID, ben, nil), domain.ErrInsufficientRole)
	limited, _ := e.svc.CreateRole(ctx, owner, ws.ID, service.RoleInput{Name: "Limited admin", Base: domain.RoleAdmin,
		Permissions: []domain.Permission{domain.PermView, domain.PermManageMembers, domain.PermRoles}})
	if err := e.svc.AssignCustomRole(ctx, owner, ws.ID, anna, &limited.ID); err != nil {
		t.Fatal(err)
	}
	// Anna may now manage roles but holds no field permission: she cannot grant it.
	_, err = e.svc.CreateRole(ctx, anna, ws.ID, service.RoleInput{Name: "Sneaky", Base: domain.RoleMember, Permissions: []domain.Permission{domain.PermFieldsManage}})
	mustCode(t, err, domain.ErrInsufficientRole)
	mustCode(t, e.svc.AssignCustomRole(ctx, anna, ws.ID, vera, &designer.ID), domain.ErrInsufficientRole)

	// Deleting a custom role sends its people back to the built-in role it ranked as.
	if err := e.svc.DeleteRole(ctx, owner, ws.ID, designer.ID); err != nil {
		t.Fatal(err)
	}
	if can(ben, domain.PermFieldsManage) || !can(ben, domain.PermProjectCreate) {
		t.Fatal("Ben is a plain member again")
	}
	log, _ := e.svc.Audit(ctx, owner, ws.ID)
	seen := map[string]bool{}
	for _, en := range log {
		seen[en.Action] = true
	}
	for _, a := range []string{"role.permissions_changed", "role.created", "member.custom_role", "role.deleted"} {
		if !seen[a] {
			t.Errorf("audit log lacks %s", a)
		}
	}
}
