package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"regexp"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

type client struct {
	t    *testing.T
	base string
	http *http.Client
}

func newClient(t *testing.T, base string) *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: t, base: base, http: &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}}
}

func (c *client) csrf() string {
	u, _ := url.Parse(c.base)
	for _, ck := range c.http.Jar.Cookies(u) {
		if ck.Name == "lk_csrf" {
			return ck.Value
		}
	}
	return ""
}

func (c *client) do(method, path string, body any, out any) int {
	c.t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, c.base+path, r)
	req.Header.Set("Content-Type", "application/json")
	if tok := c.csrf(); tok != "" {
		req.Header.Set("X-CSRF-Token", tok)
	}
	res, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer func() { _ = res.Body.Close() }()
	if out != nil {
		_ = json.NewDecoder(res.Body).Decode(out)
	}
	return res.StatusCode
}

type errBody struct {
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	tdb.Reset(t)
	t.Setenv("LK_ENV", "test")
	t.Setenv("LK_DATABASE_URL", tdb.URL)
	t.Setenv("LK_SECRET_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2Nzg5YWJjZGVm")
	t.Setenv("LK_ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
	t.Setenv("LK_PUBLIC_URL", "http://app.test")
	t.Setenv("LK_COOKIE_SECURE", "false")
	t.Setenv("LK_ATTACHMENTS_DIR", t.TempDir())
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	app, err := build(cfg, tdb.Pool, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(app.Router)
	go app.Realtime.Run(t.Context())
	t.Cleanup(srv.Close)
	t.Cleanup(app.Realtime.Close) // runs first: ends SSE streams so srv.Close can return
	return srv
}

func TestEndToEndAuthAndWorkspaces(t *testing.T) {
	srv := newServer(t)
	peter := newClient(t, srv.URL)

	var e errBody
	if code := peter.do("POST", "/api/v1/auth/login", map[string]string{"email": "x", "password": "y"}, &e); code != 403 || e.Error.Code != "common.csrf_failed" {
		t.Fatalf("missing CSRF must be rejected, got %d %s", code, e.Error.Code)
	}
	if code := peter.do("GET", "/api/v1/auth/csrf", nil, nil); code != 200 || peter.csrf() == "" {
		t.Fatal("csrf cookie not issued")
	}
	if code := peter.do("GET", "/api/v1/users/me", nil, &e); code != 401 || e.Error.Code != "common.unauthorized" {
		t.Fatalf("anonymous /users/me: %d", code)
	}

	var sess struct {
		User struct {
			ID     string `json:"id"`
			Locale string `json:"locale"`
		} `json:"user"`
	}
	if code := peter.do("POST", "/api/v1/auth/register", map[string]any{
		"name": "Peter Gabrielle", "email": "peter@example.com", "password": "Kanban-Board-2026", "locale": "en",
	}, &sess); code != 201 || sess.User.ID == "" {
		t.Fatalf("register: %d", code)
	}
	if code := peter.do("PATCH", "/api/v1/users/me", map[string]any{"locale": "uk"}, &sess.User); code != 200 || sess.User.Locale != "uk" {
		t.Fatalf("update locale: %d %+v", code, sess.User)
	}

	var spaces []struct {
		ID   string `json:"id"`
		Role string `json:"role"`
	}
	if code := peter.do("GET", "/api/v1/workspaces", nil, &spaces); code != 200 || len(spaces) != 1 || spaces[0].Role != "owner" {
		t.Fatalf("workspaces: %d %+v", code, spaces)
	}
	ws := spaces[0].ID

	if code := peter.do("POST", "/api/v1/workspaces/"+ws+"/invites", map[string]string{"email": "lisa@example.com", "role": "member"}, nil); code != 201 {
		t.Fatalf("invite: %d", code)
	}
	var payload string
	if err := tdb.Pool.QueryRow(t.Context(), `SELECT payload->>'text' FROM jobs WHERE kind='mail.send' AND payload->>'to'='lisa@example.com'`).Scan(&payload); err != nil {
		t.Fatalf("invite email not enqueued: %v", err)
	}
	token := regexp.MustCompile(`/invite/([A-Za-z0-9_-]+)`).FindStringSubmatch(payload)[1]

	lisa := newClient(t, srv.URL)
	lisa.do("GET", "/api/v1/auth/csrf", nil, nil)
	var preview struct {
		WorkspaceName string `json:"workspaceName"`
	}
	if code := lisa.do("GET", "/api/v1/invites/"+token, nil, &preview); code != 200 || preview.WorkspaceName == "" {
		t.Fatalf("preview: %d", code)
	}
	lisa.do("POST", "/api/v1/auth/register", map[string]any{"name": "Lisa Kim", "email": "lisa@example.com", "password": "Kanban-Board-2026"}, nil)
	if code := lisa.do("POST", "/api/v1/invites/"+token+"/accept", nil, nil); code != 200 {
		t.Fatalf("accept: %d", code)
	}
	var members []map[string]any
	if code := lisa.do("GET", "/api/v1/workspaces/"+ws+"/members", nil, &members); code != 200 || len(members) != 2 {
		t.Fatalf("members: %d %d", code, len(members))
	}
	if code := lisa.do("DELETE", "/api/v1/workspaces/"+ws, nil, &e); code != 403 || e.Error.Code != "workspaces.insufficient_role" {
		t.Fatalf("member deleting workspace: %d %s", code, e.Error.Code)
	}

	if code := peter.do("POST", "/api/v1/auth/refresh", nil, nil); code != 200 {
		t.Fatalf("refresh: %d", code)
	}
	if code := peter.do("POST", "/api/v1/auth/logout", nil, nil); code != 204 {
		t.Fatalf("logout: %d", code)
	}
	if code := peter.do("GET", "/api/v1/auth/session", nil, nil); code != 401 {
		t.Fatalf("session after logout: %d", code)
	}
	if code := peter.do("POST", "/api/v1/auth/refresh", nil, &e); code != 401 || e.Error.Code != "auth.session_expired" {
		t.Fatalf("refresh after logout: %d %s", code, e.Error.Code)
	}
}

func TestOAuthStartUnconfiguredAndHealth(t *testing.T) {
	srv := newServer(t)
	c := newClient(t, srv.URL)
	var e errBody
	if code := c.do("GET", "/api/v1/auth/oauth/github/start", nil, &e); code != 404 || e.Error.Code != "auth.provider_not_configured" {
		t.Fatalf("unconfigured provider: %d %s", code, e.Error.Code)
	}
	var prov map[string]bool
	if code := c.do("GET", "/api/v1/auth/providers", nil, &prov); code != 200 || prov["github"] || prov["google"] {
		t.Fatalf("providers: %v", prov)
	}
	if code := c.do("GET", "/readyz", nil, nil); code != 200 {
		t.Fatalf("readyz: %d", code)
	}
	if code := c.do("GET", "/api/v1/does-not-exist", nil, &e); code != 404 || e.Error.Code != "common.not_found" {
		t.Fatalf("unknown route: %d", code)
	}
}

func TestEndToEndProjectsAndCards(t *testing.T) {
	srv := newServer(t)
	c := newClient(t, srv.URL)
	c.do("GET", "/api/v1/auth/csrf", nil, nil)
	c.do("POST", "/api/v1/auth/register", map[string]any{"name": "Peter", "email": "p@example.com", "password": "Kanban-Board-2026", "locale": "uk"}, nil)
	var spaces []struct {
		ID string `json:"id"`
	}
	c.do("GET", "/api/v1/workspaces", nil, &spaces)
	ws := spaces[0].ID

	var project struct {
		ID, Key string
		Team    *string
	}
	if code := c.do("POST", "/api/v1/workspaces/"+ws+"/projects", map[string]any{"name": "Kanban Core", "team": "Engineering", "deadline": "2030-01-31"}, &project); code != 201 || project.Key != "KC" {
		t.Fatalf("create project: %d %+v", code, project)
	}
	var board struct {
		Columns []struct{ ID, Name, Status string } `json:"columns"`
	}
	if code := c.do("GET", "/api/v1/projects/"+project.ID+"/board", nil, &board); code != 200 || len(board.Columns) != 4 || board.Columns[0].Name != "До виконання" {
		t.Fatalf("board: %d %+v", code, board)
	}

	type card struct {
		ID, Key, Status string
		Version         int
		DueDate         *string `json:"dueDate"`
	}
	var cd card
	if code := c.do("POST", "/api/v1/workspaces/"+ws+"/cards", map[string]any{"projectId": project.ID, "title": "Ship it", "dueDate": "2030-01-10"}, &cd); code != 201 || cd.Key != "KC-1" {
		t.Fatalf("create card: %d %+v", code, cd)
	}
	// null clears the due date; absent fields stay.
	if code := c.do("PATCH", "/api/v1/cards/"+cd.ID, map[string]any{"version": cd.Version, "dueDate": nil}, &cd); code != 200 || cd.DueDate != nil {
		t.Fatalf("patch: %d %+v", code, cd)
	}
	var e errBody
	if code := c.do("PATCH", "/api/v1/cards/"+cd.ID, map[string]any{"version": 1, "title": "x"}, &e); code != 409 || e.Error.Code != "cards.version_conflict" {
		t.Fatalf("stale patch: %d %s", code, e.Error.Code)
	}
	if code := c.do("POST", "/api/v1/cards/"+cd.ID+"/move", map[string]any{"version": cd.Version, "status": "done"}, &cd); code != 200 || cd.Status != "done" {
		t.Fatalf("move: %d %+v", code, cd)
	}

	var page struct {
		Items []card `json:"items"`
		Total int    `json:"total"`
	}
	if code := c.do("GET", "/api/v1/workspaces/"+ws+"/cards?status=done&q=kc-1&sort=deadline&order=asc&pageSize=5", nil, &page); code != 200 || page.Total != 1 {
		t.Fatalf("list: %d %+v", code, page)
	}
	var counts map[string]int
	c.do("GET", "/api/v1/workspaces/"+ws+"/cards/summary", nil, &counts)
	if counts["done"] != 1 || counts["todo"] != 0 {
		t.Fatalf("counts %v", counts)
	}
	var proj struct {
		Progress  int `json:"progress"`
		TaskCount int `json:"taskCount"`
	}
	c.do("GET", "/api/v1/projects/"+project.ID, nil, &proj)
	if proj.Progress != 100 || proj.TaskCount != 1 {
		t.Fatalf("project counters %+v", proj)
	}
	var stats struct {
		Daily    []map[string]any `json:"daily"`
		Activity []map[string]any `json:"activity"`
	}
	if code := c.do("GET", "/api/v1/workspaces/"+ws+"/cards/stats?days=14", nil, &stats); code != 200 || len(stats.Daily) != 14 || len(stats.Activity) != 2 {
		t.Fatalf("stats: %d daily=%d activity=%d", code, len(stats.Daily), len(stats.Activity))
	}
	if code := c.do("PATCH", "/api/v1/projects/"+project.ID, map[string]any{"team": nil}, &project); code != 200 || project.Team != nil {
		t.Fatalf("clear team: %d %+v", code, project)
	}
	if code := c.do("GET", "/api/v1/workspaces/"+ws+"/projects?team=Engineering", nil, &page); code != 200 || page.Total != 0 {
		t.Fatalf("filter after clear: %d %d", code, page.Total)
	}
}
