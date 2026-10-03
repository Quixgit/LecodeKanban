package main

import (
	"regexp"
	"testing"
)

type wikiNode struct {
	ID       string  `json:"id"`
	ParentID *string `json:"parentId"`
	Title    string  `json:"title"`
	Detached bool    `json:"detached"`
	Access   struct {
		Role *string `json:"role"`
	} `json:"access"`
}

// Create folder → nest page → another user can't see it → share → they see it → move (with the
// widening confirmation) → trash → restore, over real HTTP with cookies and CSRF.
func TestEndToEndWiki(t *testing.T) {
	srv := newServer(t)
	peter := newClient(t, srv.URL)
	peter.do("GET", "/api/v1/auth/csrf", nil, nil)
	var sess struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	peter.do("POST", "/api/v1/auth/register", map[string]any{"name": "Peter", "email": "peter@example.com", "password": "Kanban-Board-2026"}, &sess)
	var wss []struct {
		ID string `json:"id"`
	}
	peter.do("GET", "/api/v1/workspaces", nil, &wss)
	ws := wss[0].ID

	peter.do("POST", "/api/v1/workspaces/"+ws+"/invites", map[string]string{"email": "lisa@example.com", "role": "member"}, nil)
	var payload string
	if err := tdb.Pool.QueryRow(t.Context(), `SELECT payload->>'text' FROM jobs WHERE kind='mail.send' AND payload->>'to'='lisa@example.com'`).Scan(&payload); err != nil {
		t.Fatal(err)
	}
	token := regexp.MustCompile(`/invite/([A-Za-z0-9_-]+)`).FindStringSubmatch(payload)[1]
	lisa := newClient(t, srv.URL)
	lisa.do("GET", "/api/v1/auth/csrf", nil, nil)
	var lisaSess struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	lisa.do("POST", "/api/v1/auth/register", map[string]any{"name": "Lisa", "email": "lisa@example.com", "password": "Kanban-Board-2026"}, &lisaSess)
	lisa.do("POST", "/api/v1/invites/"+token+"/accept", nil, nil)

	anon := newClient(t, srv.URL)
	if code := anon.do("GET", "/api/v1/workspaces/"+ws+"/wiki/spaces", nil, nil); code != 401 {
		t.Fatalf("anonymous wiki access: %d", code)
	}

	var space struct {
		ID     string `json:"id"`
		Access struct {
			Role string `json:"role"`
		} `json:"access"`
	}
	if code := peter.do("POST", "/api/v1/workspaces/"+ws+"/wiki/spaces", map[string]any{"name": "Runbooks"}, &space); code != 201 || space.Access.Role != "owner" {
		t.Fatalf("create space: %d %+v", code, space)
	}
	var e errBody
	if code := lisa.do("GET", "/api/v1/wiki/spaces/"+space.ID, nil, &e); code != 404 || e.Error.Code != "wiki.not_found" {
		t.Fatalf("private space must look absent: %d %s", code, e.Error.Code)
	}
	if code := lisa.do("GET", "/api/v1/wiki/spaces/not-a-uuid", nil, &e); code != 404 {
		t.Fatalf("malformed id: %d", code)
	}

	var folder, page wikiNode
	if code := peter.do("POST", "/api/v1/wiki/spaces/"+space.ID+"/nodes", map[string]any{"kind": "folder", "title": "Інциденти"}, &folder); code != 201 {
		t.Fatalf("create folder: %d", code)
	}
	if code := peter.do("POST", "/api/v1/wiki/spaces/"+space.ID+"/nodes", map[string]any{"kind": "page", "title": "Postmortem", "parentId": folder.ID}, &page); code != 201 || page.ParentID == nil {
		t.Fatalf("create page: %d %+v", code, page)
	}

	var tree struct {
		Nodes []wikiNode `json:"nodes"`
	}
	if code := lisa.do("GET", "/api/v1/wiki/spaces/"+space.ID+"/tree", nil, &e); code != 404 {
		t.Fatalf("lisa must not read the tree: %d", code)
	}
	if code := lisa.do("GET", "/api/v1/wiki/nodes/"+page.ID, nil, &e); code != 404 || e.Error.Code != "wiki.not_found" {
		t.Fatalf("lisa must not read the page: %d %s", code, e.Error.Code)
	}

	// Share just the page with Lisa as viewer.
	var grant struct {
		Role string `json:"role"`
	}
	if code := peter.do("PUT", "/api/v1/wiki/nodes/"+page.ID+"/permissions/user/"+lisaSess.User.ID, map[string]any{"role": "viewer"}, &grant); code != 200 || grant.Role != "viewer" {
		t.Fatalf("share: %d", code)
	}
	if code := peter.do("PUT", "/api/v1/wiki/nodes/"+page.ID+"/permissions/team/"+lisaSess.User.ID, map[string]any{"role": "viewer"}, &e); code != 422 {
		t.Fatalf("unknown team principal: %d", code)
	}
	if code := lisa.do("GET", "/api/v1/wiki/spaces/"+space.ID+"/tree", nil, &tree); code != 200 || len(tree.Nodes) != 1 || !tree.Nodes[0].Detached || tree.Nodes[0].ParentID != nil {
		t.Fatalf("lisa's tree: %d %+v", code, tree.Nodes)
	}
	var shared []wikiNode
	if code := lisa.do("GET", "/api/v1/workspaces/"+ws+"/wiki/shared", nil, &shared); code != 200 || len(shared) != 1 {
		t.Fatalf("shared with me: %d %d", code, len(shared))
	}
	if code := lisa.do("PATCH", "/api/v1/wiki/nodes/"+page.ID, map[string]any{"title": "x"}, &e); code != 403 || e.Error.Code != "wiki.forbidden" {
		t.Fatalf("viewer edit: %d %s", code, e.Error.Code)
	}
	if code := lisa.do("GET", "/api/v1/wiki/nodes/"+folder.ID, nil, &e); code != 404 {
		t.Fatalf("lisa must not see the parent folder: %d", code)
	}

	// Moving the page into a workspace-visible space widens access: confirmation first.
	var open struct {
		ID string `json:"id"`
	}
	peter.do("POST", "/api/v1/workspaces/"+ws+"/wiki/spaces", map[string]any{"name": "Handbook", "visibility": "workspace"}, &open)
	if code := peter.do("POST", "/api/v1/wiki/nodes/"+page.ID+"/move", map[string]any{"spaceId": open.ID}, &e); code != 409 || e.Error.Code != "wiki.confirm_widening" {
		t.Fatalf("widening move: %d %s", code, e.Error.Code)
	}
	var moved wikiNode
	if code := peter.do("POST", "/api/v1/wiki/nodes/"+page.ID+"/move", map[string]any{"spaceId": open.ID, "confirmWiden": true}, &moved); code != 200 || moved.ParentID != nil {
		t.Fatalf("confirmed move: %d %+v", code, moved)
	}

	// Trash and restore.
	if code := peter.do("DELETE", "/api/v1/wiki/nodes/"+page.ID, nil, nil); code != 204 {
		t.Fatalf("delete: %d", code)
	}
	if code := lisa.do("GET", "/api/v1/wiki/nodes/"+page.ID, nil, &e); code != 404 {
		t.Fatalf("trashed page visible: %d", code)
	}
	var trash []struct {
		Node wikiNode `json:"node"`
	}
	if code := peter.do("GET", "/api/v1/workspaces/"+ws+"/wiki/trash", nil, &trash); code != 200 || len(trash) != 1 {
		t.Fatalf("trash: %d %d", code, len(trash))
	}
	if code := peter.do("POST", "/api/v1/wiki/nodes/"+page.ID+"/restore", nil, &moved); code != 200 || moved.ID != page.ID {
		t.Fatalf("restore: %d", code)
	}
	if code := peter.do("PUT", "/api/v1/wiki/nodes/"+page.ID+"/favorite", nil, nil); code != 204 {
		t.Fatalf("favorite: %d", code)
	}
	var audit struct {
		Events []struct {
			Kind string `json:"kind"`
		} `json:"events"`
	}
	if code := peter.do("GET", "/api/v1/wiki/spaces/"+open.ID+"/audit", nil, &audit); code != 200 || len(audit.Events) < 3 {
		t.Fatalf("audit: %d %d", code, len(audit.Events))
	}
	if code := lisa.do("GET", "/api/v1/wiki/spaces/"+open.ID+"/audit", nil, &e); code != 403 {
		t.Fatalf("audit is owner-only: %d", code)
	}
}
