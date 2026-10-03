package service_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/client"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

const goodToken = "ghp_0123456789abcdefghijklmnopqrstuvwxyz"

// fakeGH records what the integration asks GitHub to do.
type fakeGH struct {
	repos    []client.RepoInfo
	hooks    map[int64]string // id → repo
	secret   string
	hookURL  string
	nextHook int64
	issues   []string // "repo#n title"
	states   []string // "repo#n closed|open"
	comments []string // "repo#n body"
	nextIss  int
}

func (f *fakeGH) User(_ context.Context, token string) (string, error) {
	if token != goodToken {
		return "", client.ErrUnauthorized
	}
	return "octo-admin", nil
}
func (f *fakeGH) Repos(context.Context, string) ([]client.RepoInfo, error) { return f.repos, nil }
func (f *fakeGH) CreateHook(_ context.Context, _, repo, url, secret string) (int64, error) {
	if repo == "acme/secret" {
		return 0, client.ErrNotFound
	}
	f.nextHook++
	if f.hooks == nil {
		f.hooks = map[int64]string{}
	}
	f.hooks[f.nextHook], f.secret, f.hookURL = repo, secret, url
	return f.nextHook, nil
}
func (f *fakeGH) DeleteHook(_ context.Context, _, _ string, id int64) error {
	delete(f.hooks, id)
	return nil
}
func (f *fakeGH) CreateIssue(_ context.Context, _, repo, title, body string) (client.Issue, error) {
	f.nextIss++
	n := 100 + f.nextIss
	f.issues = append(f.issues, fmt.Sprintf("%s#%d %s", repo, n, title)+"\n"+body)
	return client.Issue{Number: n, Title: title, URL: fmt.Sprintf("https://github.test/%s/issues/%d", repo, n), State: "open"}, nil
}
func (f *fakeGH) SetIssueState(_ context.Context, _, repo string, n int, closed bool) error {
	s := "open"
	if closed {
		s = "closed"
	}
	f.states = append(f.states, fmt.Sprintf("%s#%d %s", repo, n, s))
	return nil
}
func (f *fakeGH) Comment(_ context.Context, _, repo string, n int, body string) error {
	f.comments = append(f.comments, fmt.Sprintf("%s#%d %s", repo, n, body))
	return nil
}

// cardsAdapter mirrors the composition root's adapter over the real cards service.
type cardsAdapter struct{ c *cardssvc.Service }

func info(v cardssvc.View) service.CardInfo {
	return service.CardInfo{ID: v.ID, WorkspaceID: v.WorkspaceID, ProjectID: v.ProjectID, Number: v.Number, Key: v.Key, Title: v.Title,
		Description: v.Description, Status: string(v.Status)}
}
func (a cardsAdapter) FindByKey(ctx context.Context, ws uuid.UUID, key string, n int) (service.CardInfo, error) {
	r, err := a.c.FindByKey(ctx, ws, key, n)
	if err != nil {
		return service.CardInfo{}, err
	}
	return a.Info(ctx, r.ID)
}
func (a cardsAdapter) Get(ctx context.Context, user, id uuid.UUID) (service.CardInfo, error) {
	v, err := a.c.Get(ctx, user, id)
	return info(v), err
}
func (a cardsAdapter) Info(ctx context.Context, id uuid.UUID) (service.CardInfo, error) {
	v, err := a.c.Snapshot(ctx, id)
	return info(v), err
}
func (a cardsAdapter) MoveTo(ctx context.Context, actor, id uuid.UUID, status string) error {
	v, err := a.c.Get(ctx, actor, id)
	if err != nil {
		return err
	}
	st := carddomain.Status(status)
	_, err = a.c.Move(ctx, actor, id, carddomain.Move{Version: v.Version, Status: &st})
	return err
}
func (a cardsAdapter) Create(ctx context.Context, actor, ws, project uuid.UUID, title, desc string) (service.CardInfo, error) {
	v, err := a.c.Create(ctx, actor, ws, carddomain.NewCard{ProjectID: project, Title: title, Description: desc})
	return info(v), err
}

type world struct {
	e                              *testkit.Env
	svc                            *service.Service
	gh                             *fakeGH
	ws, plt, other                 uuid.UUID
	owner, admin, anna, viewer, no uuid.UUID
	secret                         string
}

func setup(t *testing.T) *world {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	w := &world{e: e, gh: &fakeGH{repos: []client.RepoInfo{{FullName: "acme/web"}, {FullName: "acme/api"}, {FullName: "acme/docs"}}}}
	w.owner = e.User("Olena Owner", "o@example.com")
	w.admin = e.User("Adam Admin", "ad@example.com")
	w.anna = e.User("Anna Member", "a@example.com")
	w.viewer = e.User("Vira Viewer", "v@example.com")
	w.no = e.User("Out Sider", "x@example.com")
	w.ws = e.Workspace(w.owner, map[uuid.UUID]wsdomain.Role{w.admin: wsdomain.RoleAdmin, w.anna: wsdomain.RoleMember, w.viewer: wsdomain.RoleViewer}, tdb.Pool)
	w.plt = e.Project(w.owner, w.ws, "Platform")
	w.other = e.Project(w.owner, w.ws, "Other")
	sealer, err := crypto.NewSealer(make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	w.svc = service.New(repository.New(tdb.Pool), e.Workspaces, w.gh, cardsAdapter{e.Cards}, e.Projects, sealer, e.Hints, "http://app.test",
		slog.New(slog.NewTextHandler(io.Discard, nil))).WithSyncOutbound()
	github.Register(e.Bus, w.svc)
	return w
}

// linked connects and links the Platform project to acme/web, as the administrator.
func (w *world) linked(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	if _, err := w.svc.Connect(ctx, w.admin, w.ws, goodToken); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.LinkRepo(ctx, w.admin, w.ws, w.plt, "acme/web"); err != nil {
		t.Fatal(err)
	}
	w.secret = w.gh.secret
}

func (w *world) card(t *testing.T, title string) cardssvc.View {
	t.Helper()
	return w.e.Card(w.anna, w.ws, w.plt, title)
}

func (w *world) status(t *testing.T, id uuid.UUID) string {
	t.Helper()
	v, err := w.e.Cards.Get(context.Background(), w.owner, id)
	if err != nil {
		t.Fatal(err)
	}
	return string(v.Status)
}

func (w *world) deliver(t *testing.T, event string, payload map[string]any) error {
	t.Helper()
	body, _ := json.Marshal(payload)
	mac := hmac.New(sha256.New, []byte(w.secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return w.svc.Handle(context.Background(), event, uuid.NewString(), body, sig)
}

func pr(number int, title, branch, state string, merged, draft bool) map[string]any {
	return map[string]any{"number": number, "title": title, "body": "", "html_url": fmt.Sprintf("https://github.test/acme/web/pull/%d", number),
		"state": state, "merged": merged, "draft": draft, "user": map[string]any{"login": "dev"}, "head": map[string]any{"ref": branch}}
}

func prEvent(action string, p map[string]any) map[string]any {
	return map[string]any{"action": action, "repository": map[string]any{"full_name": "acme/web"}, "pull_request": p}
}

func issueEvent(action string, number int, title, body, state string) map[string]any {
	return map[string]any{"action": action, "repository": map[string]any{"full_name": "acme/web"}, "issue": map[string]any{
		"number": number, "title": title, "body": body, "state": state, "html_url": fmt.Sprintf("https://github.test/acme/web/issues/%d", number),
		"user": map[string]any{"login": "dev"}}}
}

func TestConnectAndLinkRepos(t *testing.T) {
	w := setup(t)
	ctx := context.Background()

	if _, err := w.svc.Connect(ctx, w.anna, w.ws, goodToken); !apperr.IsCode(err, wsdomain.ErrInsufficientRole) {
		t.Fatalf("members must not connect: %v", err)
	}
	if _, err := w.svc.Connect(ctx, w.admin, w.ws, "ghp_rejected_rejected_rejected"); !apperr.IsCode(err, domain.ErrBadToken) {
		t.Fatalf("rejected token: %v", err)
	}
	s, err := w.svc.Summary(ctx, w.anna, w.ws)
	if err != nil || s.Connected || s.CanManage || s.WebhookURL != "http://app.test/api/v1/integrations/github/webhook" {
		t.Fatalf("summary before: %+v %v", s, err)
	}

	s, err = w.svc.Connect(ctx, w.admin, w.ws, goodToken)
	if err != nil || !s.Connected || s.Account != "octo-admin" || !s.Rules.PROpenedToReview || !s.Rules.SyncIssues || !s.CanManage {
		t.Fatalf("connect: %+v %v", s, err)
	}
	if _, err := w.svc.AvailableRepos(ctx, w.anna, w.ws); !apperr.IsCode(err, wsdomain.ErrInsufficientRole) {
		t.Fatalf("members must not list repos: %v", err)
	}

	if _, err := w.svc.LinkRepo(ctx, w.admin, w.ws, w.plt, "acme/secret"); !apperr.IsCode(err, domain.ErrRepoNotFound) {
		t.Fatalf("invisible repo: %v", err)
	}
	if _, err := w.svc.LinkRepo(ctx, w.admin, w.ws, uuid.New(), "acme/web"); !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("unknown project: %v", err)
	}
	r, err := w.svc.LinkRepo(ctx, w.admin, w.ws, w.plt, "acme/web")
	if err != nil || r.FullName != "acme/web" || len(w.gh.hooks) != 1 || w.gh.secret == "" || w.gh.hookURL != s.WebhookURL {
		t.Fatalf("link: %+v %v hooks=%v", r, err, w.gh.hooks)
	}
	if _, err := w.svc.LinkRepo(ctx, w.admin, w.ws, w.plt, "acme/api"); !apperr.IsCode(err, domain.ErrRepoLinked) {
		t.Fatalf("a project has one repository: %v", err)
	}
	if len(w.gh.hooks) != 1 {
		t.Fatalf("the failed link must not leave a webhook behind: %v", w.gh.hooks)
	}
	names, _ := w.svc.AvailableRepos(ctx, w.admin, w.ws)
	if strings.Join(names, ",") != "acme/api,acme/docs" {
		t.Fatalf("available: %v", names)
	}

	// Reconnecting keeps the secret, so the webhooks that exist keep working.
	secret := w.gh.secret
	if _, err := w.svc.Connect(ctx, w.admin, w.ws, goodToken); err != nil {
		t.Fatal(err)
	}
	w.secret = secret
	if err := w.deliver(t, "ping", map[string]any{"repository": map[string]any{"full_name": "acme/web"}}); err != nil {
		t.Fatalf("webhook after reconnect: %v", err)
	}

	if err := w.svc.UnlinkRepo(ctx, w.admin, w.ws, r.ID); err != nil || len(w.gh.hooks) != 0 {
		t.Fatalf("unlink: %v hooks=%v", err, w.gh.hooks)
	}
	if _, err := w.svc.LinkRepo(ctx, w.admin, w.ws, w.plt, "acme/web"); err != nil {
		t.Fatal(err)
	}
	if err := w.svc.Disconnect(ctx, w.admin, w.ws); err != nil || len(w.gh.hooks) != 0 {
		t.Fatalf("disconnect: %v hooks=%v", err, w.gh.hooks)
	}
	if s, _ := w.svc.Summary(ctx, w.admin, w.ws); s.Connected || len(s.Repos) != 0 {
		t.Fatalf("after disconnect: %+v", s)
	}
}

func TestWebhookIsAuthenticated(t *testing.T) {
	w := setup(t)
	w.linked(t)
	body, _ := json.Marshal(prEvent("opened", pr(1, "Platform-1", "x", "open", false, false)))

	if err := w.svc.Handle(context.Background(), "pull_request", "d1", body, "sha256=00"); !apperr.IsCode(err, domain.ErrBadSignature) {
		t.Fatalf("forged signature: %v", err)
	}
	unknown, _ := json.Marshal(map[string]any{"action": "opened", "repository": map[string]any{"full_name": "evil/repo"}})
	if err := w.svc.Handle(context.Background(), "pull_request", "d2", unknown, "sha256=00"); !apperr.IsCode(err, domain.ErrRepoNotFound) {
		t.Fatalf("unlinked repository: %v", err)
	}
	if err := w.svc.Handle(context.Background(), "pull_request", "d3", []byte("not json"), ""); !apperr.IsCode(err, domain.ErrBadSignature) {
		t.Fatalf("garbage: %v", err)
	}

	// A delivery is processed once; a paused connection ignores everything.
	c := w.card(t, "Fix login")
	key := fmt.Sprintf("PLT-%d", c.Number)
	_ = key
	off := false
	if _, err := w.svc.UpdateRules(context.Background(), w.admin, w.ws, service.RulesPatch{Enabled: &off}); err != nil {
		t.Fatal(err)
	}
	if err := w.deliver(t, "pull_request", prEvent("opened", pr(5, c.Key+" fix", "b", "open", false, false))); err != nil {
		t.Fatal(err)
	}
	if got := w.status(t, c.ID); got != "todo" {
		t.Fatalf("paused connection moved a card: %s", got)
	}
}

func TestPullRequestsMoveTasks(t *testing.T) {
	w := setup(t)
	w.linked(t)
	ctx := context.Background()
	a, b, c := w.card(t, "Fix login"), w.card(t, "Cache"), w.card(t, "Docs")

	// A draft links but does not move; ready-for-review moves to In review.
	if err := w.deliver(t, "pull_request", prEvent("opened", pr(7, a.Key+": fix login", "feature/x", "open", false, true))); err != nil {
		t.Fatal(err)
	}
	if got := w.status(t, a.ID); got != "todo" {
		t.Fatalf("draft moved the card: %s", got)
	}
	links, _ := w.svc.CardPanel(ctx, w.anna, a.ID)
	if len(links.Links) != 1 || links.Links[0].State != domain.Draft || links.Links[0].Kind != domain.PR {
		t.Fatalf("draft link: %+v", links.Links)
	}
	if err := w.deliver(t, "pull_request", prEvent("ready_for_review", pr(7, a.Key+": fix login", "feature/x", "open", false, false))); err != nil {
		t.Fatal(err)
	}
	if got := w.status(t, a.ID); got != "in_review" {
		t.Fatalf("ready for review: %s", got)
	}

	// A branch name or body names tasks too; several tasks in one pull request all follow it.
	p := pr(8, "Speed things up", strings.ToLower(b.Key)+"-cache", "open", false, false)
	p["body"] = "Also finishes " + c.Key
	if err := w.deliver(t, "pull_request", prEvent("opened", p)); err != nil {
		t.Fatal(err)
	}
	if w.status(t, b.ID) != "in_review" || w.status(t, c.ID) != "in_review" {
		t.Fatalf("branch/body keys: %s %s", w.status(t, b.ID), w.status(t, c.ID))
	}

	// Merging finishes them; closing without merging does not.
	if err := w.deliver(t, "pull_request", prEvent("closed", pr(7, a.Key+": fix login", "feature/x", "closed", true, false))); err != nil {
		t.Fatal(err)
	}
	if err := w.deliver(t, "pull_request", prEvent("closed", pr(8, "Speed things up", strings.ToLower(b.Key)+"-cache", "closed", false, false))); err != nil {
		t.Fatal(err)
	}
	if w.status(t, a.ID) != "done" || w.status(t, b.ID) != "in_review" {
		t.Fatalf("merge / close: %s %s", w.status(t, a.ID), w.status(t, b.ID))
	}
	panel, _ := w.svc.CardPanel(ctx, w.anna, a.ID)
	if panel.Links[0].State != domain.Merged {
		t.Fatalf("merged state: %+v", panel.Links[0])
	}
	// Echo guard: the merge moved the card on its own, so nothing was sent back to GitHub.
	if len(w.gh.comments) != 0 || len(w.gh.states) != 0 {
		t.Fatalf("GitHub-originated moves were echoed: %v %v", w.gh.comments, w.gh.states)
	}

	// Rules can be switched off; a task key nobody has is ignored.
	no := false
	if _, err := w.svc.UpdateRules(ctx, w.admin, w.ws, service.RulesPatch{PRMergedToDone: &no}); err != nil {
		t.Fatal(err)
	}
	d := w.card(t, "Later")
	if err := w.deliver(t, "pull_request", prEvent("closed", pr(9, d.Key+" and NOPE-99", "x", "closed", true, false))); err != nil {
		t.Fatal(err)
	}
	if w.status(t, d.ID) != "todo" {
		t.Fatalf("rule off but card moved: %s", w.status(t, d.ID))
	}
}

func TestIssuesAndCardsFollowEachOther(t *testing.T) {
	w := setup(t)
	w.linked(t)
	ctx := context.Background()
	count := func() int {
		list, _, err := w.e.Cards.List(ctx, w.owner, w.ws, carddomain.Filter{ProjectID: &w.plt}, pagination.Params{Page: 1, Size: 100})
		if err != nil {
			t.Fatal(err)
		}
		return len(list)
	}

	// GitHub → task: a new issue becomes a card; closing and reopening it moves the card.
	if err := w.deliver(t, "issues", issueEvent("opened", 11, "Crash on login", "Steps to reproduce", "open")); err != nil {
		t.Fatal(err)
	}
	if count() != 1 {
		t.Fatalf("issue did not become a card: %d", count())
	}
	list, _, _ := w.e.Cards.List(ctx, w.owner, w.ws, carddomain.Filter{ProjectID: &w.plt}, pagination.Params{Page: 1, Size: 100})
	card := list[0]
	if card.Title != "Crash on login" || !strings.Contains(card.Description, "Steps to reproduce") || !strings.Contains(card.Description, "issues/11") {
		t.Fatalf("card from issue: %+v", card.Card)
	}
	if err := w.deliver(t, "issues", issueEvent("opened", 11, "Crash on login", "", "open")); err != nil || count() != 1 {
		t.Fatalf("the same issue twice: %v %d", err, count())
	}
	if err := w.deliver(t, "issues", issueEvent("closed", 11, "Crash on login", "", "closed")); err != nil {
		t.Fatal(err)
	}
	if w.status(t, card.ID) != "done" {
		t.Fatalf("closed issue: %s", w.status(t, card.ID))
	}
	if err := w.deliver(t, "issues", issueEvent("reopened", 11, "Crash on login", "", "open")); err != nil {
		t.Fatal(err)
	}
	if w.status(t, card.ID) != "todo" {
		t.Fatalf("reopened issue: %s", w.status(t, card.ID))
	}
	if len(w.gh.states) != 0 {
		t.Fatalf("echoed to GitHub: %v", w.gh.states)
	}

	// Task → GitHub: creating an issue for a card links it, and the webhook for it adds no second card.
	mine := w.card(t, "Rate limits")
	before := count()
	l, err := w.svc.CreateIssue(ctx, w.anna, mine.ID)
	if err != nil || l.Kind != domain.Issue || l.Number != 101 || !strings.Contains(w.gh.issues[0], "lk:card="+mine.ID.String()) {
		t.Fatalf("create issue: %+v %v %v", l, err, w.gh.issues)
	}
	if again, err := w.svc.CreateIssue(ctx, w.anna, mine.ID); err != nil || again.Number != 101 || len(w.gh.issues) != 1 {
		t.Fatalf("a second issue for the same card: %+v %v", again, err)
	}
	if err := w.deliver(t, "issues", issueEvent("opened", 101, mine.Key+" Rate limits", domain.IssueMarker(mine.ID), "open")); err != nil {
		t.Fatal(err)
	}
	if count() != before {
		t.Fatalf("our own issue created a duplicate card: %d vs %d", count(), before)
	}

	// Moving the card to Done closes its issue; moving it back reopens it.
	if err := moveTo(t, w, mine.ID, carddomain.Done); err != nil {
		t.Fatal(err)
	}
	if strings.Join(w.gh.states, ";") != "acme/web#101 closed" {
		t.Fatalf("done should close the issue: %v", w.gh.states)
	}
	if err := moveTo(t, w, mine.ID, carddomain.InProgress); err != nil {
		t.Fatal(err)
	}
	if strings.Join(w.gh.states, ";") != "acme/web#101 closed;acme/web#101 open" {
		t.Fatalf("leaving done should reopen it: %v", w.gh.states)
	}

	// With issue sync off, nothing flows either way.
	no := false
	if _, err := w.svc.UpdateRules(ctx, w.admin, w.ws, service.RulesPatch{SyncIssues: &no}); err != nil {
		t.Fatal(err)
	}
	n := count()
	if err := w.deliver(t, "issues", issueEvent("opened", 12, "Another", "", "open")); err != nil || count() != n {
		t.Fatalf("sync off but a card appeared: %v", err)
	}
	if err := moveTo(t, w, mine.ID, carddomain.Done); err != nil || len(w.gh.states) != 2 {
		t.Fatalf("sync off but GitHub was told: %v %v", err, w.gh.states)
	}
}

func TestMovingATaskCommentsOnItsPullRequest(t *testing.T) {
	w := setup(t)
	w.linked(t)
	a := w.card(t, "Fix login")
	if err := w.deliver(t, "pull_request", prEvent("opened", pr(7, a.Key+" fix", "x", "open", false, false))); err != nil {
		t.Fatal(err)
	}
	if len(w.gh.comments) != 0 {
		t.Fatalf("the rule's own move commented: %v", w.gh.comments)
	}
	if err := moveTo(t, w, a.ID, carddomain.InProgress); err != nil {
		t.Fatal(err)
	}
	if len(w.gh.comments) != 1 || !strings.HasPrefix(w.gh.comments[0], "acme/web#7 Task **"+a.Key+"** moved to") || !strings.Contains(w.gh.comments[0], a.ID.String()) {
		t.Fatalf("comment: %v", w.gh.comments)
	}
	no := false
	if _, err := w.svc.UpdateRules(context.Background(), w.admin, w.ws, service.RulesPatch{CommentOnPR: &no}); err != nil {
		t.Fatal(err)
	}
	if err := moveTo(t, w, a.ID, carddomain.InReview); err != nil || len(w.gh.comments) != 1 {
		t.Fatalf("comment rule off: %v %v", err, w.gh.comments)
	}
}

func TestCardPanel(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	c := w.card(t, "Migrate server to new infrastructure")

	p, err := w.svc.CardPanel(ctx, w.anna, c.ID)
	if err != nil || p.Active || p.Branch != strings.ToLower(c.Key)+"-migrate-server-to-new-infrastructure" {
		t.Fatalf("not connected: %+v %v", p, err)
	}
	w.linked(t)
	p, _ = w.svc.CardPanel(ctx, w.anna, c.ID)
	if !p.Active || p.Repo != "acme/web" || !p.CanCreateIssue {
		t.Fatalf("connected: %+v", p)
	}
	// A card in a project without a repository shows nothing active.
	o := w.e.Card(w.anna, w.ws, w.other, "Elsewhere")
	if p, _ := w.svc.CardPanel(ctx, w.anna, o.ID); p.Active {
		t.Fatalf("project without repo: %+v", p)
	}
	if _, err := w.svc.CardPanel(ctx, w.no, c.ID); err == nil {
		t.Fatal("outsider read a card's GitHub panel")
	}
	if _, err := w.svc.CreateIssue(ctx, w.viewer, c.ID); err == nil {
		t.Fatal("a viewer created an issue")
	}
	if _, err := w.svc.CreateIssue(ctx, w.anna, o.ID); !apperr.IsCode(err, domain.ErrProjectNotSet) {
		t.Fatalf("issue without a repository: %v", err)
	}
	if _, err := w.svc.CreateIssue(ctx, w.anna, c.ID); err != nil {
		t.Fatal(err)
	}
	p, _ = w.svc.CardPanel(ctx, w.anna, c.ID)
	if p.CanCreateIssue || len(p.Links) != 1 || p.Links[0].Kind != domain.Issue {
		t.Fatalf("after creating an issue: %+v", p)
	}
}

func moveTo(t *testing.T, w *world, id uuid.UUID, st carddomain.Status) error {
	t.Helper()
	v, err := w.e.Cards.Get(context.Background(), w.anna, id)
	if err != nil {
		return err
	}
	_, err = w.e.Cards.Move(context.Background(), w.anna, id, carddomain.Move{Version: v.Version, Status: &st})
	return err
}
