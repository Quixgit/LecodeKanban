package domain_test

import (
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

var (
	owner  = uuid.MustParse("00000000-0000-0000-0000-00000000000a") // space owner
	author = uuid.MustParse("00000000-0000-0000-0000-00000000000b") // page creator
	bob    = uuid.MustParse("00000000-0000-0000-0000-00000000000c")
	carol  = uuid.MustParse("00000000-0000-0000-0000-00000000000d")
	team   = uuid.MustParse("00000000-0000-0000-0000-0000000000e1")
)

func el(owner uuid.UUID, vis domain.Visibility, wsRole domain.Role, grants ...domain.Grant) domain.Element {
	return domain.Element{ID: uuid.New(), Visibility: vis, WorkspaceRole: wsRole, OwnerID: owner, Grants: grants}
}

func gUser(id uuid.UUID, r domain.Role) domain.Grant {
	return domain.Grant{Kind: domain.PrincipalUser, PrincipalID: id, Role: r}
}

func gTeam(id uuid.UUID, r domain.Role) domain.Grant {
	return domain.Grant{Kind: domain.PrincipalTeam, PrincipalID: id, Role: r}
}

func TestResolveMatrix(t *testing.T) {
	member := func(id uuid.UUID) domain.Subject {
		return domain.Subject{UserID: id, WorkspaceRole: wsdomain.RoleMember}
	}
	admin := domain.Subject{UserID: carol, WorkspaceRole: wsdomain.RoleAdmin}
	viewerWS := domain.Subject{UserID: bob, WorkspaceRole: wsdomain.RoleViewer}
	teamMember := domain.Subject{UserID: bob, Teams: []uuid.UUID{team}, WorkspaceRole: wsdomain.RoleMember}
	outsider := domain.Subject{UserID: bob}

	space := func(vis domain.Visibility, wsRole domain.Role, g ...domain.Grant) domain.Element {
		return el(owner, vis, wsRole, g...)
	}

	tests := []struct {
		name  string
		sub   domain.Subject
		chain []domain.Element
		role  domain.Role
		via   domain.Via
		vis   domain.Visibility
	}{
		{"space owner owns a private space", member(owner), []domain.Element{space(domain.Private, domain.RoleViewer)}, domain.RoleOwner, domain.ViaOwner, domain.Private},
		{"stranger sees nothing in a private space", member(bob), []domain.Element{space(domain.Private, domain.RoleViewer)}, "", domain.ViaNone, domain.Private},
		{"workspace admin has no special access to private content", admin, []domain.Element{space(domain.Private, domain.RoleViewer)}, "", domain.ViaNone, domain.Private},
		{"non-member never gets access, even with a grant", outsider, []domain.Element{space(domain.Workspace, domain.RoleEditor, gUser(bob, domain.RoleOwner))}, "", domain.ViaNone, ""},
		{"workspace visibility gives members read", member(bob), []domain.Element{space(domain.Workspace, domain.RoleViewer)}, domain.RoleViewer, domain.ViaWorkspace, domain.Workspace},
		{"workspace visibility can allow edit", member(bob), []domain.Element{space(domain.Workspace, domain.RoleEditor)}, domain.RoleEditor, domain.ViaWorkspace, domain.Workspace},
		{"workspace viewers are capped to read even when editing is open", viewerWS, []domain.Element{space(domain.Workspace, domain.RoleEditor)}, domain.RoleViewer, domain.ViaWorkspace, domain.Workspace},
		{"workspace viewers are capped to read even with an editor grant", viewerWS, []domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleEditor))}, domain.RoleViewer, domain.ViaGrant, domain.Shared},
		{"shared space: grant gives the role", member(bob), []domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleCommenter))}, domain.RoleCommenter, domain.ViaGrant, domain.Shared},
		{"shared space: no grant, no access", member(carol), []domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleEditor))}, "", domain.ViaNone, domain.Shared},
		{"team grant reaches team members", teamMember, []domain.Element{space(domain.Shared, domain.RoleViewer, gTeam(team, domain.RoleEditor))}, domain.RoleEditor, domain.ViaGrant, domain.Shared},
		{"team grant ignores non-members of the team", member(bob), []domain.Element{space(domain.Shared, domain.RoleViewer, gTeam(team, domain.RoleEditor))}, "", domain.ViaNone, domain.Shared},
		{"best of user and team grants on the same element", teamMember, []domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleViewer), gTeam(team, domain.RoleEditor))}, domain.RoleEditor, domain.ViaGrant, domain.Shared},
		{
			"page inherits workspace visibility from the space",
			member(bob),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, "", domain.RoleViewer)},
			domain.RoleViewer, domain.ViaWorkspace, domain.Workspace,
		},
		{
			"space owner reaches pages of others through inheritance",
			member(owner),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, "", domain.RoleViewer)},
			domain.RoleOwner, domain.ViaOwner, domain.Workspace,
		},
		{
			"page creator owns the page",
			member(author),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, "", domain.RoleViewer)},
			domain.RoleOwner, domain.ViaOwner, domain.Workspace,
		},
		{
			"a private page is a boundary: the space owner is locked out",
			member(owner),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, domain.Private, domain.RoleViewer)},
			"", domain.ViaNone, domain.Private,
		},
		{
			"a private page is a boundary: space-level grants do not reach it",
			member(bob),
			[]domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleEditor)), el(author, domain.Private, domain.RoleViewer)},
			"", domain.ViaNone, domain.Private,
		},
		{
			"a private page can be opened to one person",
			member(bob),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, domain.Private, domain.RoleViewer, gUser(bob, domain.RoleViewer))},
			domain.RoleViewer, domain.ViaGrant, domain.Private,
		},
		{
			"grant on a private folder is inherited by its children",
			member(bob),
			[]domain.Element{
				space(domain.Workspace, domain.RoleViewer),
				el(author, domain.Private, domain.RoleViewer, gUser(bob, domain.RoleEditor)),
				el(author, "", domain.RoleViewer),
			},
			domain.RoleEditor, domain.ViaGrant, domain.Private,
		},
		{
			"child of a private folder stays private",
			member(carol),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, domain.Private, domain.RoleViewer), el(author, "", domain.RoleViewer)},
			"", domain.ViaNone, domain.Private,
		},
		{
			"a child can open up inside a private folder",
			member(carol),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, domain.Private, domain.RoleViewer), el(author, domain.Workspace, domain.RoleViewer)},
			domain.RoleViewer, domain.ViaWorkspace, domain.Workspace,
		},
		{
			"a shared child of a workspace space drops the workspace audience",
			member(carol),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, domain.Shared, domain.RoleViewer)},
			"", domain.ViaNone, domain.Shared,
		},
		{
			"a shared child keeps grants of the space",
			member(bob),
			[]domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleEditor)), el(author, domain.Shared, domain.RoleViewer)},
			domain.RoleEditor, domain.ViaGrant, domain.Shared,
		},
		{
			"a node grant overrides downwards: viewer on the page beats editor on the space",
			member(bob),
			[]domain.Element{space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleEditor)), el(author, "", domain.RoleViewer, gUser(bob, domain.RoleViewer))},
			domain.RoleViewer, domain.ViaGrant, domain.Shared,
		},
		{
			"a node grant overrides upwards: editor on the page beats workspace read",
			member(bob),
			[]domain.Element{space(domain.Workspace, domain.RoleViewer), el(author, "", domain.RoleViewer, gUser(bob, domain.RoleEditor))},
			domain.RoleEditor, domain.ViaGrant, domain.Workspace,
		},
		{
			"closest grant wins over a farther one",
			member(bob),
			[]domain.Element{
				space(domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleOwner)),
				el(author, "", domain.RoleViewer, gUser(bob, domain.RoleCommenter)),
				el(author, "", domain.RoleViewer),
			},
			domain.RoleCommenter, domain.ViaGrant, domain.Shared,
		},
		{"empty chain grants nothing", member(owner), nil, "", domain.ViaNone, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := domain.Resolve(tc.sub, tc.chain)
			if got.Role != tc.role || got.Via != tc.via || got.Visibility != tc.vis {
				t.Fatalf("got role=%q via=%q vis=%q, want role=%q via=%q vis=%q", got.Role, got.Via, got.Visibility, tc.role, tc.via, tc.vis)
			}
		})
	}
}

func TestCapabilities(t *testing.T) {
	tests := []struct {
		role                      domain.Role
		view, comment, edit, mgmt bool
	}{
		{"", false, false, false, false},
		{domain.RoleViewer, true, false, false, false},
		{domain.RoleCommenter, true, true, false, false},
		{domain.RoleEditor, true, true, true, false},
		{domain.RoleOwner, true, true, true, true},
	}
	for _, tc := range tests {
		got := [4]bool{tc.role.Can(domain.CapView), tc.role.Can(domain.CapComment), tc.role.Can(domain.CapEdit), tc.role.Can(domain.CapManage)}
		if want := [4]bool{tc.view, tc.comment, tc.edit, tc.mgmt}; got != want {
			t.Errorf("role %q: got %v want %v", tc.role, got, want)
		}
	}
}

func TestWidens(t *testing.T) {
	priv := el(owner, domain.Private, domain.RoleViewer)
	work := el(owner, domain.Workspace, domain.RoleViewer)
	workEdit := el(owner, domain.Workspace, domain.RoleEditor)
	shared := el(owner, domain.Shared, domain.RoleViewer, gUser(bob, domain.RoleViewer))
	page := el(author, "", domain.RoleViewer)
	page2 := el(author, "", domain.RoleViewer, gUser(carol, domain.RoleViewer))

	tests := []struct {
		name          string
		before, after []domain.Element
		widens        bool
	}{
		{"private to workspace", []domain.Element{priv, page}, []domain.Element{work, page}, true},
		{"workspace to private", []domain.Element{work, page}, []domain.Element{priv, page}, false},
		{"workspace read to workspace edit", []domain.Element{work, page}, []domain.Element{workEdit, page}, true},
		{"same parent chain", []domain.Element{work, page}, []domain.Element{work, page}, false},
		{"private to shared brings the space's guests in", []domain.Element{priv, page}, []domain.Element{shared, page}, true},
		{"moving under a space with another owner adds that owner", []domain.Element{priv, page}, []domain.Element{el(bob, domain.Private, domain.RoleViewer), page}, true},
		{"a node's own grants do not count as new", []domain.Element{priv, page2}, []domain.Element{priv, page2}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := domain.AudienceOf(tc.after).WidensComparedTo(domain.AudienceOf(tc.before))
			if got != tc.widens {
				t.Fatalf("widens=%v, want %v", got, tc.widens)
			}
		})
	}
}
