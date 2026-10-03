package service_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	wsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	wssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

// fakeTeams knows one team with the given members.
type fakeTeams struct {
	team    uuid.UUID
	members map[uuid.UUID]bool
}

func (f fakeTeams) TeamsOf(_ context.Context, _, user uuid.UUID) ([]uuid.UUID, error) {
	if f.members[user] {
		return []uuid.UUID{f.team}, nil
	}
	return nil, nil
}

func (f fakeTeams) Exists(_ context.Context, _, team uuid.UUID) (bool, error) {
	return team == f.team, nil
}

type env struct {
	svc   *service.Service
	users *userssvc.Service
	wsr   *wsrepo.Repo
	ws    uuid.UUID
	alice uuid.UUID // workspace owner and the main author
	bob   uuid.UUID // member
	carol uuid.UUID // member
	admin uuid.UUID // workspace admin
	view  uuid.UUID // workspace viewer
	out   uuid.UUID // not a member
	team  uuid.UUID
}

func setup(t *testing.T) *env {
	t.Helper()
	cur = t
	tdb.Reset(t)
	bus := eventbus.New()
	e := &env{users: userssvc.New(usersrepo.New(tdb.Pool), bus), wsr: wsrepo.New(tdb.Pool), team: uuid.New()}
	wsSvc := wssvc.New(e.wsr, e.users, bus, func(context.Context, mailer.Message, string) error { return nil }, "http://app.test")
	mk := func(name string) uuid.UUID {
		u, err := e.users.Create(context.Background(), usersdomain.NewUser{Email: name + "@wiki.test", Name: name, Locale: usersdomain.LocaleEN})
		if err != nil {
			t.Fatal(err)
		}
		return u.ID
	}
	e.alice, e.bob, e.carol, e.admin, e.view, e.out = mk("alice"), mk("bob"), mk("carol"), mk("admin"), mk("viewer"), mk("outsider")
	w, err := wsSvc.Create(context.Background(), e.alice, "Acme")
	if err != nil {
		t.Fatal(err)
	}
	e.ws = w.ID
	for u, r := range map[uuid.UUID]wsdomain.Role{e.bob: wsdomain.RoleMember, e.carol: wsdomain.RoleMember,
		e.admin: wsdomain.RoleAdmin, e.view: wsdomain.RoleViewer} {
		if err := e.wsr.AddMember(context.Background(), e.ws, u, r); err != nil {
			t.Fatal(err)
		}
	}
	e.svc = service.New(repository.New(tdb.Pool), wsSvc, fakeTeams{team: e.team, members: map[uuid.UUID]bool{e.carol: true}})
	return e
}

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

// cur is the running test; must/ok report through it so multi-value calls can be wrapped directly.
var cur *testing.T

func must[T any](v T, err error) T {
	cur.Helper()
	if err != nil {
		cur.Fatal(err)
	}
	return v
}

func (e *env) space(t *testing.T, user uuid.UUID, vis domain.Visibility, role domain.Role) domain.Space {
	t.Helper()
	v, err := e.svc.CreateSpace(context.Background(), user, e.ws, service.SpaceInput{Name: "Runbooks", Visibility: vis, WorkspaceRole: role})
	return must(v, err).Space
}

func (e *env) node(t *testing.T, user uuid.UUID, space uuid.UUID, parent *uuid.UUID, kind domain.Kind, title string) domain.Node {
	t.Helper()
	v, err := e.svc.CreateNode(context.Background(), user, space, service.NodeInput{ParentID: parent, Kind: kind, Title: title})
	return must(v, err).Node
}

func ids(tr service.Tree) map[string]bool {
	out := map[string]bool{}
	for _, n := range tr.Nodes {
		out[n.Node.Title] = true
	}
	return out
}

func TestSpacesAndRoles(t *testing.T) {
	e := setup(t)
	ctx := context.Background()

	if _, err := e.svc.CreateSpace(ctx, e.view, e.ws, service.SpaceInput{Name: "X"}); err == nil {
		t.Fatal("workspace viewers must not create spaces")
	}
	if _, err := e.svc.CreateSpace(ctx, e.out, e.ws, service.SpaceInput{Name: "X"}); err == nil {
		t.Fatal("non-members must not create spaces")
	}
	_, err := e.svc.CreateSpace(ctx, e.alice, e.ws, service.SpaceInput{Name: "  "})
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.CreateSpace(ctx, e.alice, e.ws, service.SpaceInput{Name: "Ok", Visibility: "public"})
	mustCode(t, err, apperr.Validation)

	priv := e.space(t, e.alice, domain.Private, "")
	open := e.space(t, e.alice, domain.Workspace, domain.RoleViewer)

	list := must(e.svc.Spaces(ctx, e.bob, e.ws))
	if len(list) != 1 || list[0].Space.ID != open.ID || list[0].Access.Role != domain.RoleViewer {
		t.Fatalf("bob should only see the workspace space as viewer: %+v", list)
	}
	if got := must(e.svc.Spaces(ctx, e.admin, e.ws)); len(got) != 1 {
		t.Fatalf("admin gets no special access to private spaces: %d", len(got))
	}
	if got := must(e.svc.Spaces(ctx, e.alice, e.ws)); len(got) != 2 {
		t.Fatalf("owner sees both: %d", len(got))
	}
	_, err = e.svc.Space(ctx, e.bob, priv.ID)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.Space(ctx, e.out, open.ID)
	mustCode(t, err, domain.ErrNotFound)

	// Only owners change settings.
	n := "Renamed"
	_, err = e.svc.UpdateSpace(ctx, e.bob, open.ID, service.SpacePatch{Name: &n})
	mustCode(t, err, domain.ErrForbidden)
	got := must(e.svc.UpdateSpace(ctx, e.alice, open.ID, service.SpacePatch{Name: &n}))
	if got.Space.Name != n {
		t.Fatal("rename failed")
	}
	mustCode(t, e.svc.DeleteSpace(ctx, e.bob, open.ID), domain.ErrForbidden)
	if err := e.svc.DeleteSpace(ctx, e.alice, open.ID); err != nil {
		t.Fatal(err)
	}
}

func TestTreeOrderingAndDepth(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)

	a := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "A")
	b := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "B")
	// Insert C between A and B.
	c := must(e.svc.CreateNode(ctx, e.bob, sp.ID, service.NodeInput{Kind: domain.KindPage, Title: "Привіт, світе", AfterID: &a.ID})).Node
	child := e.node(t, e.bob, sp.ID, &a.ID, domain.KindPage, "child")

	tr := must(e.svc.Tree(ctx, e.carol, sp.ID))
	var order []string
	for _, n := range tr.Nodes {
		if n.Node.Depth == 1 {
			order = append(order, n.Node.Title)
		}
	}
	if len(order) != 3 || order[0] != "A" || order[1] != c.Title || order[2] != "B" {
		t.Fatalf("root order %v", order)
	}
	if child.Depth != 2 || child.Path != a.Path+child.ID.String()+"/" {
		t.Fatalf("child depth/path wrong: %+v", child)
	}
	_ = b

	// Depth limit.
	two := 2
	must(e.svc.UpdateSpace(ctx, e.alice, sp.ID, service.SpacePatch{MaxDepth: &two}))
	_, err := e.svc.CreateNode(ctx, e.alice, sp.ID, service.NodeInput{ParentID: &child.ID, Kind: domain.KindPage, Title: "too deep"})
	mustCode(t, err, domain.ErrMaxDepth)
	// Titles are validated (Cyrillic counts by characters).
	_, err = e.svc.CreateNode(ctx, e.alice, sp.ID, service.NodeInput{Kind: domain.KindPage, Title: " "})
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.CreateNode(ctx, e.alice, sp.ID, service.NodeInput{Kind: "doc", Title: "x"})
	mustCode(t, err, apperr.Validation)

	// A workspace viewer cannot write even though the space is open for editing.
	_, err = e.svc.CreateNode(ctx, e.view, sp.ID, service.NodeInput{Kind: domain.KindPage, Title: "nope"})
	mustCode(t, err, domain.ErrForbidden)
}

func TestMaxDepthCannotDropBelowExistingNesting(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Private, "")
	p := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "1")
	p = e.node(t, e.alice, sp.ID, &p.ID, domain.KindFolder, "2")
	e.node(t, e.alice, sp.ID, &p.ID, domain.KindPage, "3")
	two := 2
	_, err := e.svc.UpdateSpace(ctx, e.alice, sp.ID, service.SpacePatch{MaxDepth: &two})
	mustCode(t, err, domain.ErrMaxDepth)
}

// Every channel that could reveal a private page is exercised with a second user.
func TestPrivatePageNeverLeaks(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
	pub := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Public folder")
	secret := e.node(t, e.alice, sp.ID, &pub.ID, domain.KindPage, "Salaries")
	inner := e.node(t, e.alice, sp.ID, &secret.ID, domain.KindPage, "Inner")
	must(e.svc.SetVisibility(ctx, e.alice, service.Target{SpaceID: sp.ID, NodeID: &secret.ID}, domain.Private, ""))
	ok(t, e.svc.Favorite(ctx, e.alice, secret.ID))

	for name, who := range map[string]uuid.UUID{"member": e.bob, "admin": e.admin, "viewer": e.view} {
		tr := must(e.svc.Tree(ctx, who, sp.ID))
		if got := ids(tr); got["Salaries"] || got["Inner"] || !got["Public folder"] {
			t.Fatalf("%s: tree leaks or hides wrongly: %v", name, got)
		}
		for _, id := range []uuid.UUID{secret.ID, inner.ID} {
			_, err := e.svc.Node(ctx, who, id)
			mustCode(t, err, domain.ErrNotFound)
			_, err = e.svc.Access(ctx, who, service.Target{SpaceID: sp.ID, NodeID: &id})
			mustCode(t, err, domain.ErrNotFound)
			mustCode(t, e.svc.Favorite(ctx, who, id), domain.ErrNotFound)
			mustCode(t, e.svc.DeleteNode(ctx, who, id), domain.ErrNotFound)
			_, err = e.svc.UpdateNode(ctx, who, id, service.NodePatch{})
			mustCode(t, err, domain.ErrNotFound)
			_, err = e.svc.MoveNode(ctx, who, id, service.MoveInput{})
			mustCode(t, err, domain.ErrNotFound)
			_, err = e.svc.SetGrant(ctx, who, service.Target{SpaceID: sp.ID, NodeID: &id}, domain.PrincipalUser, who, domain.RoleOwner)
			mustCode(t, err, domain.ErrNotFound)
		}
		_, err := e.svc.CreateNode(ctx, who, sp.ID, service.NodeInput{ParentID: &secret.ID, Kind: domain.KindPage, Title: "x"})
		mustCode(t, err, domain.ErrNotFound)
		if got := must(e.svc.Recent(ctx, who, e.ws)); len(got) != 0 {
			t.Fatalf("%s: recents leak %d", name, len(got))
		}
		if got := must(e.svc.SharedWithMe(ctx, who, e.ws)); len(got) != 0 {
			t.Fatalf("%s: shared-with-me leaks", name)
		}
		if got := must(e.svc.Trash(ctx, who, e.ws)); len(got) != 0 {
			t.Fatalf("%s: trash leaks", name)
		}
	}
	// The author sees it, in recents and in "my private".
	must(e.svc.Node(ctx, e.alice, secret.ID))
	if got := must(e.svc.Recent(ctx, e.alice, e.ws)); len(got) != 1 {
		t.Fatalf("author recents: %d", len(got))
	}
	// Inner inherits private from "Salaries", so both are private pages of the author.
	if got := must(e.svc.MyPrivate(ctx, e.alice, e.ws)); len(got) != 2 {
		t.Fatalf("my private: %d", len(got))
	}
	// Trashed, still invisible to others; visible to the author.
	if err := e.svc.DeleteNode(ctx, e.alice, secret.ID); err != nil {
		t.Fatal(err)
	}
	if got := must(e.svc.Trash(ctx, e.bob, e.ws)); len(got) != 0 {
		t.Fatal("trash leaks a private page")
	}
	if got := must(e.svc.Trash(ctx, e.alice, e.ws)); len(got) != 1 {
		t.Fatal("author should see their trash")
	}
	_, err := e.svc.RestoreNode(ctx, e.bob, secret.ID)
	mustCode(t, err, domain.ErrNotFound)

	// A favourite that becomes inaccessible disappears from the list.
	other := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "Plan")
	ok(t, e.svc.Favorite(ctx, e.bob, other.ID))
	if got := must(e.svc.Favorites(ctx, e.bob, e.ws)); len(got) != 1 {
		t.Fatalf("favourites: %d", len(got))
	}
	must(e.svc.SetVisibility(ctx, e.alice, service.Target{SpaceID: sp.ID, NodeID: &other.ID}, domain.Private, ""))
	if got := must(e.svc.Favorites(ctx, e.bob, e.ws)); len(got) != 0 {
		t.Fatal("favourites leak a page that became private")
	}
	must(e.svc.Node(ctx, e.alice, other.ID))
}

func TestSharingGrantsAndSharedWithMe(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Private, "")
	folder := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Secret folder")
	page := e.node(t, e.alice, sp.ID, &folder.ID, domain.KindPage, "Runbook")
	target := service.Target{SpaceID: sp.ID, NodeID: &page.ID}

	// Only owners share; invitees must be workspace members.
	_, err := e.svc.SetGrant(ctx, e.bob, target, domain.PrincipalUser, e.bob, domain.RoleOwner)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.SetGrant(ctx, e.alice, target, domain.PrincipalUser, e.out, domain.RoleViewer)
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.SetGrant(ctx, e.alice, target, domain.PrincipalUser, e.bob, "boss")
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.SetGrant(ctx, e.alice, target, domain.PrincipalTeam, uuid.New(), domain.RoleViewer)
	mustCode(t, err, apperr.Validation)

	must(e.svc.SetGrant(ctx, e.alice, target, domain.PrincipalUser, e.bob, domain.RoleViewer))
	must(e.svc.SetGrant(ctx, e.alice, target, domain.PrincipalTeam, e.team, domain.RoleEditor))

	// Bob (viewer): sees the page, not its parent; the page is detached in the tree.
	tr := must(e.svc.Tree(ctx, e.bob, sp.ID))
	if len(tr.Nodes) != 1 || tr.Nodes[0].Node.ID != page.ID || !tr.Nodes[0].Detached {
		t.Fatalf("bob's tree: %+v", tr.Nodes)
	}
	if tr.Access.Role != "" {
		t.Fatal("bob has no space-level access")
	}
	if got := must(e.svc.Spaces(ctx, e.bob, e.ws)); len(got) != 0 {
		t.Fatal("space must not be listed for node-level guests")
	}
	if got := must(e.svc.SharedWithMe(ctx, e.bob, e.ws)); len(got) != 1 || got[0].Node.ID != page.ID {
		t.Fatalf("shared with me: %+v", got)
	}
	_, err = e.svc.UpdateNode(ctx, e.bob, page.ID, service.NodePatch{Title: ptr("hack")})
	mustCode(t, err, domain.ErrForbidden)
	_, err = e.svc.Node(ctx, e.bob, folder.ID)
	mustCode(t, err, domain.ErrNotFound)
	// Viewers don't see who else has access; editors (carol via team) do.
	if s := must(e.svc.Access(ctx, e.bob, target)); len(s.Grants) != 0 || s.CanManage {
		t.Fatalf("viewer sees grants: %+v", s)
	}
	cs := must(e.svc.Access(ctx, e.carol, target))
	if cs.Role != domain.RoleEditor || len(cs.Grants) != 2 || cs.CanManage {
		t.Fatalf("carol summary: %+v", cs)
	}
	// Carol, as editor through her team, can edit but not share.
	must(e.svc.UpdateNode(ctx, e.carol, page.ID, service.NodePatch{Title: ptr("Runbook v2")}))
	_, err = e.svc.SetGrant(ctx, e.carol, target, domain.PrincipalUser, e.carol, domain.RoleOwner)
	mustCode(t, err, domain.ErrForbidden)

	// Revoking removes access immediately.
	if err := e.svc.RemoveGrant(ctx, e.alice, target, domain.PrincipalUser, e.bob); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Node(ctx, e.bob, page.ID)
	mustCode(t, err, domain.ErrNotFound)
	mustCode(t, e.svc.RemoveGrant(ctx, e.alice, target, domain.PrincipalUser, e.bob), domain.ErrNotFound)

	// Grants on a private ancestor are inherited by children and shown with their source.
	child := e.node(t, e.alice, sp.ID, &page.ID, domain.KindPage, "Child")
	cs = must(e.svc.Access(ctx, e.alice, service.Target{SpaceID: sp.ID, NodeID: &child.ID}))
	if !cs.Inherited || cs.Visibility != domain.Private || cs.Source.ID != sp.ID || len(cs.Grants) != 1 || !cs.Grants[0].Inherited {
		t.Fatalf("inherited summary: %+v", cs)
	}

	// Audit trail, owner only.
	if _, err := e.svc.Audit(ctx, e.bob, sp.ID, 0, 0); err == nil {
		t.Fatal("audit is owner-only")
	}
	page2 := must(e.svc.Audit(ctx, e.alice, sp.ID, 0, 100))
	kinds := map[string]int{}
	for _, ev := range page2.Events {
		kinds[ev.Kind]++
	}
	if kinds[domain.AuditPermissionGranted] != 2 || kinds[domain.AuditPermissionRevoked] != 1 || kinds[domain.AuditNodeCreated] != 3 {
		t.Fatalf("audit kinds: %v", kinds)
	}
}

func ptr[T any](v T) *T { return &v }

func ok(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func TestVisibilityInheritanceAndSettings(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
	folder := e.node(t, e.bob, sp.ID, nil, domain.KindFolder, "Bob's folder")
	page := e.node(t, e.bob, sp.ID, &folder.ID, domain.KindPage, "page")
	tp := service.Target{SpaceID: sp.ID, NodeID: &page.ID}

	s := must(e.svc.Access(ctx, e.carol, tp))
	if s.Visibility != domain.Workspace || !s.Inherited || s.Source.Kind != "space" || s.Role != domain.RoleEditor {
		t.Fatalf("inherited from space: %+v", s)
	}
	// Carol cannot change visibility; Bob (page owner) can, the space owner can too.
	_, err := e.svc.SetVisibility(ctx, e.carol, tp, domain.Private, "")
	mustCode(t, err, domain.ErrForbidden)
	s = must(e.svc.SetVisibility(ctx, e.bob, tp, domain.Private, ""))
	if s.Inherited || s.Own != domain.Private {
		t.Fatalf("own visibility: %+v", s)
	}
	if got := ids(must(e.svc.Tree(ctx, e.alice, sp.ID))); got["page"] {
		t.Fatal("space owner must be locked out of a private page")
	}
	// Back to inheriting.
	s = must(e.svc.SetVisibility(ctx, e.bob, tp, "", ""))
	if !s.Inherited || s.Visibility != domain.Workspace {
		t.Fatalf("after inherit: %+v", s)
	}
	// Spaces always keep an explicit visibility; bad values are rejected.
	_, err = e.svc.SetVisibility(ctx, e.alice, service.Target{SpaceID: sp.ID}, "", "")
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.SetVisibility(ctx, e.alice, tp, "public", "")
	mustCode(t, err, apperr.Validation)
	_, err = e.svc.SetVisibility(ctx, e.alice, tp, domain.Workspace, "boss")
	mustCode(t, err, apperr.Validation)
	// Members edit through workspace visibility, but a workspace viewer never can.
	must(e.svc.UpdateNode(ctx, e.carol, page.ID, service.NodePatch{Title: ptr("edited")}))
	_, err = e.svc.UpdateNode(ctx, e.view, page.ID, service.NodePatch{Title: ptr("nope")})
	mustCode(t, err, domain.ErrForbidden)
}

func TestMove(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	open := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
	priv := e.space(t, e.alice, domain.Private, "")

	a := e.node(t, e.alice, open.ID, nil, domain.KindFolder, "A")
	b := e.node(t, e.alice, open.ID, nil, domain.KindFolder, "B")
	a1 := e.node(t, e.alice, open.ID, &a.ID, domain.KindPage, "A1")
	a2 := e.node(t, e.alice, open.ID, &a1.ID, domain.KindPage, "A2")

	// Reorder: B before A.
	moved := must(e.svc.MoveNode(ctx, e.alice, b.ID, service.MoveInput{BeforeID: &a.ID}))
	if moved.Node.Rank >= a.Rank {
		t.Fatalf("B should rank before A: %s vs %s", moved.Node.Rank, a.Rank)
	}
	_, err := e.svc.MoveNode(ctx, e.alice, b.ID, service.MoveInput{AfterID: &a1.ID}) // a1 is not a sibling
	mustCode(t, err, domain.ErrBadPlacement)

	// Nest A (with its subtree) under B: paths and depth follow.
	must(e.svc.MoveNode(ctx, e.bob, a.ID, service.MoveInput{ParentID: &b.ID}))
	tr := must(e.svc.Tree(ctx, e.bob, open.ID))
	depth := map[string]int{}
	for _, n := range tr.Nodes {
		depth[n.Node.Title] = n.Node.Depth
	}
	if depth["A"] != 2 || depth["A1"] != 3 || depth["A2"] != 4 {
		t.Fatalf("depths after move: %v", depth)
	}

	// Cycles are refused.
	_, err = e.svc.MoveNode(ctx, e.alice, b.ID, service.MoveInput{ParentID: &a2.ID})
	mustCode(t, err, domain.ErrCycle)
	_, err = e.svc.MoveNode(ctx, e.alice, b.ID, service.MoveInput{ParentID: &b.ID})
	mustCode(t, err, domain.ErrCycle)

	// Reordering inside the same parent is fine.
	must(e.svc.MoveNode(ctx, e.alice, a1.ID, service.MoveInput{ParentID: &a.ID}))

	// Moving into a private space needs rights there; bob has none.
	_, err = e.svc.MoveNode(ctx, e.bob, a1.ID, service.MoveInput{SpaceID: &priv.ID})
	mustCode(t, err, domain.ErrNotFound)

	// Private → open space would widen access: confirmation first.
	secret := e.node(t, e.alice, priv.ID, nil, domain.KindPage, "Secret")
	sub := e.node(t, e.alice, priv.ID, &secret.ID, domain.KindPage, "Sub")
	_, err = e.svc.MoveNode(ctx, e.alice, secret.ID, service.MoveInput{SpaceID: &open.ID})
	mustCode(t, err, domain.ErrConfirmWiden)
	if got := ids(must(e.svc.Tree(ctx, e.bob, open.ID))); got["Secret"] {
		t.Fatal("a refused move must not change anything")
	}
	// A node-level grant travels with the node to the other space.
	must(e.svc.SetGrant(ctx, e.alice, service.Target{SpaceID: priv.ID, NodeID: &secret.ID}, domain.PrincipalUser, e.carol, domain.RoleEditor))
	res := must(e.svc.MoveNode(ctx, e.alice, secret.ID, service.MoveInput{SpaceID: &open.ID, ConfirmWiden: true}))
	if res.Node.SpaceID != open.ID || res.Node.Depth != 1 {
		t.Fatalf("cross-space move: %+v", res.Node)
	}
	tr = must(e.svc.Tree(ctx, e.carol, open.ID))
	var subSpace uuid.UUID
	for _, n := range tr.Nodes {
		if n.Node.ID == sub.ID {
			subSpace = n.Node.SpaceID
		}
	}
	if subSpace != open.ID {
		t.Fatal("descendants must follow into the new space")
	}
	s := must(e.svc.Access(ctx, e.alice, service.Target{SpaceID: open.ID, NodeID: &secret.ID}))
	if len(s.Grants) != 1 || s.Grants[0].PrincipalID != e.carol {
		t.Fatalf("grant should have moved: %+v", s.Grants)
	}
	// Moving back into the private space never needs confirmation (it narrows access).
	must(e.svc.MoveNode(ctx, e.alice, secret.ID, service.MoveInput{SpaceID: &priv.ID}))
	audit := must(e.svc.Audit(ctx, e.alice, open.ID, 0, 100))
	moves := 0
	for _, ev := range audit.Events {
		if ev.Kind == domain.AuditNodeMoved {
			moves++
		}
	}
	if moves == 0 {
		t.Fatal("moves must be audited")
	}
}

func TestTrashRestorePurge(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
	f := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Folder")
	p := e.node(t, e.alice, sp.ID, &f.ID, domain.KindPage, "Page")
	g := e.node(t, e.alice, sp.ID, &p.ID, domain.KindPage, "Grandchild")

	if err := e.svc.DeleteNode(ctx, e.bob, p.ID); err != nil {
		t.Fatal(err)
	}
	if got := ids(must(e.svc.Tree(ctx, e.alice, sp.ID))); got["Page"] || got["Grandchild"] || !got["Folder"] {
		t.Fatalf("subtree should be hidden: %v", got)
	}
	_, err := e.svc.Node(ctx, e.alice, g.ID)
	mustCode(t, err, domain.ErrNotFound)
	tr := must(e.svc.Trash(ctx, e.carol, e.ws))
	if len(tr) != 1 || tr[0].Node.ID != p.ID {
		t.Fatalf("trash: %+v", tr)
	}
	if got := must(e.svc.Trash(ctx, e.view, e.ws)); len(got) != 0 {
		t.Fatal("viewers cannot restore, so they see no trash")
	}
	// Only a trash root can be restored.
	_, err = e.svc.RestoreNode(ctx, e.alice, g.ID)
	mustCode(t, err, domain.ErrNotTrashed)

	// Restore in place: the parent is alive, so the subtree comes back where it was.
	res := must(e.svc.RestoreNode(ctx, e.carol, p.ID))
	if res.Node.ParentID == nil || *res.Node.ParentID != f.ID || res.Node.Depth != 2 {
		t.Fatalf("restored in place: %+v", res.Node)
	}
	if got := ids(must(e.svc.Tree(ctx, e.alice, sp.ID))); !got["Page"] || !got["Grandchild"] {
		t.Fatalf("subtree should be back: %v", got)
	}
	_, err = e.svc.RestoreNode(ctx, e.alice, p.ID)
	mustCode(t, err, domain.ErrNotTrashed)
}

func TestRestoreRelocatesWhenParentIsGone(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
	f := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Folder")
	p := e.node(t, e.alice, sp.ID, &f.ID, domain.KindPage, "Page")
	g := e.node(t, e.alice, sp.ID, &p.ID, domain.KindPage, "Grandchild")

	// Page is trashed first, then its folder; the page's own trash entry survives separately.
	ok(t, e.svc.DeleteNode(ctx, e.alice, p.ID))
	ok(t, e.svc.DeleteNode(ctx, e.alice, f.ID))
	if got := must(e.svc.Trash(ctx, e.alice, e.ws)); len(got) != 2 {
		t.Fatalf("two trash roots expected, got %d", len(got))
	}
	// The page cannot be restored under a trashed folder: it lands at the root,
	// keeping the visibility it had (inherited workspace/editor), subtree intact.
	res := must(e.svc.RestoreNode(ctx, e.alice, p.ID))
	if res.Node.ParentID != nil || res.Node.Depth != 1 || res.Node.Visibility != domain.Workspace {
		t.Fatalf("relocated restore: %+v", res.Node)
	}
	tr := must(e.svc.Tree(ctx, e.bob, sp.ID))
	depth := map[string]int{}
	for _, n := range tr.Nodes {
		depth[n.Node.Title] = n.Node.Depth
	}
	if depth["Page"] != 1 || depth["Grandchild"] != 2 || depth["Folder"] != 0 {
		t.Fatalf("tree after relocation: %v", depth)
	}
	_, err := e.svc.Node(ctx, e.bob, g.ID)
	ok(t, err)

	// Purge: owner only, permanent, subtree gone.
	_, err = e.svc.RestoreNode(ctx, e.alice, f.ID)
	ok(t, err)
	ok(t, e.svc.DeleteNode(ctx, e.alice, f.ID))
	mustCode(t, e.svc.PurgeNode(ctx, e.bob, f.ID), domain.ErrForbidden)
	mustCode(t, e.svc.PurgeNode(ctx, e.alice, g.ID), domain.ErrNotTrashed)
	ok(t, e.svc.PurgeNode(ctx, e.alice, f.ID))
	_, err = e.svc.RestoreNode(ctx, e.alice, f.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestRestoreAfterParentWasPurged(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Private, "")
	f := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Folder")
	p := e.node(t, e.alice, sp.ID, &f.ID, domain.KindPage, "Page")
	ok(t, e.svc.DeleteNode(ctx, e.alice, p.ID))
	ok(t, e.svc.DeleteNode(ctx, e.alice, f.ID))
	ok(t, e.svc.PurgeNode(ctx, e.alice, f.ID)) // the independently trashed page survives
	res := must(e.svc.RestoreNode(ctx, e.alice, p.ID))
	if res.Node.ParentID != nil || res.Node.Depth != 1 || res.Node.Visibility != domain.Private {
		t.Fatalf("restore after purge: %+v", res.Node)
	}
}

func TestPurgeExpired(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Private, "")
	old := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "Old")
	fresh := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "Fresh")
	ok(t, e.svc.DeleteNode(ctx, e.alice, old.ID))
	ok(t, e.svc.DeleteNode(ctx, e.alice, fresh.ID))
	if _, err := tdb.Pool.Exec(ctx, `UPDATE wiki_nodes SET deleted_at = now() - interval '31 days' WHERE id = $1`, old.ID); err != nil {
		t.Fatal(err)
	}
	// Expired entries are not listed even before the job runs.
	if got := must(e.svc.Trash(ctx, e.alice, e.ws)); len(got) != 1 || got[0].Node.ID != fresh.ID {
		t.Fatalf("trash should hide expired: %+v", got)
	}
	n := must(e.svc.PurgeExpired(ctx))
	if n != 1 {
		t.Fatalf("purged %d rows, want 1", n)
	}
	var left int
	if err := tdb.Pool.QueryRow(ctx, `SELECT count(*) FROM wiki_nodes`).Scan(&left); err != nil || left != 1 {
		t.Fatalf("rows left %d (%v)", left, err)
	}
}

func TestFavoritesRecentsAndMembership(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Workspace, domain.RoleViewer)
	p := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "Page")

	ok(t, e.svc.Favorite(ctx, e.bob, p.ID))
	ok(t, e.svc.Favorite(ctx, e.bob, p.ID)) // idempotent
	v := must(e.svc.Node(ctx, e.bob, p.ID))
	if !v.Favorite {
		t.Fatal("favorite flag missing")
	}
	if got := must(e.svc.Recent(ctx, e.bob, e.ws)); len(got) != 1 {
		t.Fatalf("recent: %d", len(got))
	}
	if got := must(e.svc.Favorites(ctx, e.carol, e.ws)); len(got) != 0 {
		t.Fatal("favourites are per user")
	}
	ok(t, e.svc.Unfavorite(ctx, e.bob, p.ID))
	if got := must(e.svc.Favorites(ctx, e.bob, e.ws)); len(got) != 0 {
		t.Fatal("unfavorite failed")
	}

	// A user who leaves the workspace loses everything at once.
	ok(t, e.wsr.RemoveMember(ctx, e.ws, e.bob))
	_, err := e.svc.Node(ctx, e.bob, p.ID)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.Spaces(ctx, e.bob, e.ws)
	mustCode(t, err, domain.ErrNotFound)
	_, err = e.svc.Tree(ctx, e.out, sp.ID)
	mustCode(t, err, domain.ErrNotFound)
}

func TestMoveDepthCountsWholeSubtree(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := must(e.svc.CreateSpace(ctx, e.alice, e.ws, service.SpaceInput{Name: "Shallow", MaxDepth: 3})).Space
	x := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "X")
	y := e.node(t, e.alice, sp.ID, &x.ID, domain.KindFolder, "Y")
	z := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Z")
	e.node(t, e.alice, sp.ID, &z.ID, domain.KindPage, "W")
	_, err := e.svc.MoveNode(ctx, e.alice, z.ID, service.MoveInput{ParentID: &y.ID}) // Z at 3, W at 4
	mustCode(t, err, domain.ErrMaxDepth)
	w2 := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "V")
	must(e.svc.MoveNode(ctx, e.alice, w2.ID, service.MoveInput{ParentID: &y.ID})) // a leaf fits at depth 3
}

// An independently trashed page that inherited "private" from a folder must stay private when that
// folder is purged, by hand or by the expiry job (the parent link is gone by then).
func TestPurgedParentKeepsInheritedVisibility(t *testing.T) {
	for _, mode := range []string{"manual", "expiry"} {
		t.Run(mode, func(t *testing.T) {
			e := setup(t)
			ctx := context.Background()
			sp := e.space(t, e.alice, domain.Workspace, domain.RoleEditor)
			f := e.node(t, e.alice, sp.ID, nil, domain.KindFolder, "Private folder")
			must(e.svc.SetVisibility(ctx, e.alice, service.Target{SpaceID: sp.ID, NodeID: &f.ID}, domain.Private, ""))
			p := e.node(t, e.alice, sp.ID, &f.ID, domain.KindPage, "Page")
			ok(t, e.svc.DeleteNode(ctx, e.alice, p.ID))
			ok(t, e.svc.DeleteNode(ctx, e.alice, f.ID))
			if mode == "manual" {
				ok(t, e.svc.PurgeNode(ctx, e.alice, f.ID))
			} else {
				if _, err := tdb.Pool.Exec(ctx, `UPDATE wiki_nodes SET deleted_at = now() - interval '31 days' WHERE id = $1`, f.ID); err != nil {
					t.Fatal(err)
				}
				if n := must(e.svc.PurgeExpired(ctx)); n != 1 {
					t.Fatalf("purged %d roots, want 1", n)
				}
			}
			res := must(e.svc.RestoreNode(ctx, e.alice, p.ID))
			if res.Node.Visibility != domain.Private || res.Access.Visibility != domain.Private {
				t.Fatalf("restored page must stay private, got %q / %q", res.Node.Visibility, res.Access.Visibility)
			}
			_, err := e.svc.Node(ctx, e.bob, p.ID)
			mustCode(t, err, domain.ErrNotFound)
		})
	}
}

func TestRestoreRejectsExpiredTrash(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	sp := e.space(t, e.alice, domain.Private, "")
	p := e.node(t, e.alice, sp.ID, nil, domain.KindPage, "Old")
	ok(t, e.svc.DeleteNode(ctx, e.alice, p.ID))
	if _, err := tdb.Pool.Exec(ctx, `UPDATE wiki_nodes SET deleted_at = now() - interval '31 days' WHERE id = $1`, p.ID); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.RestoreNode(ctx, e.alice, p.ID)
	mustCode(t, err, domain.ErrNotFound)
}
