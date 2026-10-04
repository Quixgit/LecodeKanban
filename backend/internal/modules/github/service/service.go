// Package service connects a workspace to GitHub and keeps tasks and pull requests / issues in step.
package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/client"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// GitHub is the API client (the client package satisfies it).
type GitHub interface {
	User(ctx context.Context, token string) (string, error)
	Repos(ctx context.Context, token string) ([]client.RepoInfo, error)
	CreateHook(ctx context.Context, token, repo, url, secret string) (int64, error)
	DeleteHook(ctx context.Context, token, repo string, id int64) error
	CreateIssue(ctx context.Context, token, repo, title, body string) (client.Issue, error)
	SetIssueState(ctx context.Context, token, repo string, number int, closed bool) error
	Comment(ctx context.Context, token, repo string, number int, body string) error
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

// CardInfo is a card as this module needs it.
type CardInfo struct {
	ID, WorkspaceID, ProjectID uuid.UUID
	Number                     int
	Key                        string
	Title, Description         string
	Status                     string
}

// Cards reaches the cards module (an adapter in the composition root).
type Cards interface {
	FindByKey(ctx context.Context, ws uuid.UUID, projectKey string, number int) (CardInfo, error)
	// Get checks the person may see the card.
	Get(ctx context.Context, user, id uuid.UUID) (CardInfo, error)
	// Info reads a card for event handling, without an access check.
	Info(ctx context.Context, id uuid.UUID) (CardInfo, error)
	MoveTo(ctx context.Context, actor, id uuid.UUID, status string) error
	Create(ctx context.Context, actor, ws, project uuid.UUID, title, description string) (CardInfo, error)
}

type Projects interface {
	Ref(ctx context.Context, id uuid.UUID) (projectsdomain.Ref, error)
}

type Hints interface {
	Publish(ctx context.Context, m realtime.Message)
}

type fromGitHub struct{}

// Service is the GitHub integration.
type Service struct {
	repo      *repository.Repo
	ws        Workspaces
	gh        GitHub
	cards     Cards
	projects  Projects
	sealer    *crypto.Sealer
	hints     Hints
	publicURL string
	log       *slog.Logger
	// async runs outbound calls to GitHub off the request; tests make it synchronous.
	async func(func())
}

func New(repo *repository.Repo, ws Workspaces, gh GitHub, cards Cards, projects Projects, sealer *crypto.Sealer, hints Hints,
	publicURL string, log *slog.Logger) *Service {
	s := &Service{repo: repo, ws: ws, gh: gh, cards: cards, projects: projects, sealer: sealer, hints: hints, publicURL: publicURL, log: log}
	s.async = func(f func()) { go f() }
	return s
}

// WithSyncOutbound makes calls to GitHub run inline (tests).
func (s *Service) WithSyncOutbound() *Service {
	s.async = func(f func()) { f() }
	return s
}

func aad(ws uuid.UUID, what string) []byte { return []byte("github|" + ws.String() + "|" + what) }

// WebhookURL is where GitHub delivers events.
func (s *Service) WebhookURL() string { return s.publicURL + "/api/v1/integrations/github/webhook" }

func (s *Service) hint(ctx context.Context, ws uuid.UUID, card *uuid.UUID) {
	if s.hints != nil {
		s.hints.Publish(ctx, realtime.Message{Type: "github.link", WorkspaceID: ws, CardID: card})
	}
}

// admin checks the person may manage the connection (owners and administrators).
func (s *Service) admin(ctx context.Context, user, ws uuid.UUID) error {
	role, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView)
	if err != nil {
		return err
	}
	if !role.Can(wsdomain.PermIntegrations) {
		return apperr.New(wsdomain.ErrInsufficientRole, "administrators only")
	}
	return nil
}

func (s *Service) token(c domain.Connection) (string, error) {
	b, err := s.sealer.Open(c.Token, aad(c.WorkspaceID, "token"))
	return string(b), err
}

func (s *Service) secret(c domain.Connection) (string, error) {
	b, err := s.sealer.Open(c.WebhookSecret, aad(c.WorkspaceID, "secret"))
	return string(b), err
}

func upstream(err error) error {
	return apperr.New(domain.ErrUpstream, "github request failed").WithMeta("detail", err.Error())
}

// RepoView is a linked repository.
type RepoView struct {
	ID        uuid.UUID
	FullName  string
	ProjectID uuid.UUID
}

// Summary is the connection as the Integrations page shows it.
type Summary struct {
	Connected  bool
	Enabled    bool
	Account    string
	Rules      domain.Rules
	Repos      []RepoView
	WebhookURL string
	CanManage  bool
}

func (s *Service) Summary(ctx context.Context, user, ws uuid.UUID) (Summary, error) {
	role, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView)
	if err != nil {
		return Summary{}, err
	}
	out := Summary{WebhookURL: s.WebhookURL(), CanManage: role.Can(wsdomain.PermIntegrations)}
	c, err := s.repo.Connection(ctx, ws)
	if apperr.IsCode(err, domain.ErrNotConnected) {
		return out, nil
	}
	if err != nil {
		return Summary{}, err
	}
	repos, err := s.repo.Repos(ctx, ws)
	if err != nil {
		return Summary{}, err
	}
	out.Connected, out.Enabled, out.Account, out.Rules = true, c.Enabled, c.AccountLogin, c.Rules
	out.Repos = make([]RepoView, len(repos))
	for i, r := range repos {
		out.Repos[i] = RepoView{ID: r.ID, FullName: r.FullName, ProjectID: r.ProjectID}
	}
	return out, nil
}

// Connect stores an access token after checking it works. Reconnecting keeps the webhook secret, so the
// webhooks already registered keep working.
func (s *Service) Connect(ctx context.Context, user, ws uuid.UUID, token string) (Summary, error) {
	if err := s.admin(ctx, user, ws); err != nil {
		return Summary{}, err
	}
	token = strings.TrimSpace(token)
	var v validation.V
	v.Length("token", token, 20, 255)
	if err := v.Err(); err != nil {
		return Summary{}, err
	}
	login, err := s.gh.User(ctx, token)
	if err != nil {
		if err == client.ErrUnauthorized {
			return Summary{}, apperr.New(domain.ErrBadToken, "GitHub rejected the token")
		}
		return Summary{}, upstream(err)
	}
	sealedToken, err := s.sealer.Seal([]byte(token), aad(ws, "token"))
	if err != nil {
		return Summary{}, err
	}
	var sealedSecret []byte
	if old, err := s.repo.Connection(ctx, ws); err == nil {
		sealedSecret = old.WebhookSecret
	} else {
		secret, err := crypto.NewToken(32)
		if err != nil {
			return Summary{}, err
		}
		if sealedSecret, err = s.sealer.Seal([]byte(secret), aad(ws, "secret")); err != nil {
			return Summary{}, err
		}
	}
	if _, err := s.repo.Connect(ctx, ws, user, login, sealedToken, sealedSecret); err != nil {
		return Summary{}, err
	}
	s.hint(ctx, ws, nil)
	return s.Summary(ctx, user, ws)
}

// Disconnect removes the webhooks it registered (best effort) and forgets the token, repositories and links.
func (s *Service) Disconnect(ctx context.Context, user, ws uuid.UUID) error {
	if err := s.admin(ctx, user, ws); err != nil {
		return err
	}
	c, err := s.repo.Connection(ctx, ws)
	if err != nil {
		return err
	}
	if token, err := s.token(c); err == nil {
		repos, _ := s.repo.Repos(ctx, ws)
		for _, r := range repos {
			if r.HookID != nil {
				if err := s.gh.DeleteHook(ctx, token, r.FullName, *r.HookID); err != nil {
					s.log.Warn("github hook removal failed", slog.String("repo", r.FullName), slog.Any("err", err))
				}
			}
		}
	}
	if err := s.repo.Disconnect(ctx, ws); err != nil {
		return err
	}
	s.hint(ctx, ws, nil)
	return nil
}

// RulesPatch changes the switches; nil fields stay.
type RulesPatch struct {
	Enabled          *bool
	PROpenedToReview *bool
	PRMergedToDone   *bool
	SyncIssues       *bool
	CommentOnPR      *bool
}

func (s *Service) UpdateRules(ctx context.Context, user, ws uuid.UUID, p RulesPatch) (Summary, error) {
	if err := s.admin(ctx, user, ws); err != nil {
		return Summary{}, err
	}
	c, err := s.repo.Connection(ctx, ws)
	if err != nil {
		return Summary{}, err
	}
	set := func(dst *bool, v *bool) {
		if v != nil {
			*dst = *v
		}
	}
	set(&c.Enabled, p.Enabled)
	set(&c.Rules.PROpenedToReview, p.PROpenedToReview)
	set(&c.Rules.PRMergedToDone, p.PRMergedToDone)
	set(&c.Rules.SyncIssues, p.SyncIssues)
	set(&c.Rules.CommentOnPR, p.CommentOnPR)
	if _, err := s.repo.UpdateRules(ctx, ws, c.Enabled, c.Rules); err != nil {
		return Summary{}, err
	}
	s.hint(ctx, ws, nil)
	return s.Summary(ctx, user, ws)
}

// AvailableRepos lists repositories the token can reach that are not linked yet.
func (s *Service) AvailableRepos(ctx context.Context, user, ws uuid.UUID) ([]string, error) {
	if err := s.admin(ctx, user, ws); err != nil {
		return nil, err
	}
	c, err := s.repo.Connection(ctx, ws)
	if err != nil {
		return nil, err
	}
	token, err := s.token(c)
	if err != nil {
		return nil, err
	}
	all, err := s.gh.Repos(ctx, token)
	if err != nil {
		return nil, s.tokenError(ctx, err)
	}
	linked, err := s.repo.Repos(ctx, ws)
	if err != nil {
		return nil, err
	}
	taken := map[string]bool{}
	for _, r := range linked {
		taken[strings.ToLower(r.FullName)] = true
	}
	var out []string
	for _, r := range all {
		if !taken[strings.ToLower(r.FullName)] {
			out = append(out, r.FullName)
		}
	}
	return out, nil
}

func (s *Service) tokenError(_ context.Context, err error) error {
	if err == client.ErrUnauthorized {
		return apperr.New(domain.ErrBadToken, "GitHub rejected the token")
	}
	return upstream(err)
}

// LinkRepo ties a project to a repository and registers the webhook on it.
func (s *Service) LinkRepo(ctx context.Context, user, ws, project uuid.UUID, full string) (RepoView, error) {
	if err := s.admin(ctx, user, ws); err != nil {
		return RepoView{}, err
	}
	c, err := s.repo.Connection(ctx, ws)
	if err != nil {
		return RepoView{}, err
	}
	var v validation.V
	full = strings.TrimSpace(full)
	if parts := strings.Split(full, "/"); len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		v.Add("repo", validation.Required, nil)
	}
	if p, err := s.projects.Ref(ctx, project); err != nil || p.WorkspaceID != ws {
		v.Add("projectId", validation.NotFound, nil)
	}
	if err := v.Err(); err != nil {
		return RepoView{}, err
	}
	token, err := s.token(c)
	if err != nil {
		return RepoView{}, err
	}
	secret, err := s.secret(c)
	if err != nil {
		return RepoView{}, err
	}
	hook, err := s.gh.CreateHook(ctx, token, full, s.WebhookURL(), secret)
	if err != nil {
		if err == client.ErrNotFound {
			return RepoView{}, apperr.New(domain.ErrRepoNotFound, "repository not visible to the token")
		}
		return RepoView{}, s.tokenError(ctx, err)
	}
	r, err := s.repo.AddRepo(ctx, ws, project, full, &hook)
	if err != nil {
		_ = s.gh.DeleteHook(ctx, token, full, hook)
		return RepoView{}, err
	}
	s.hint(ctx, ws, nil)
	return RepoView{ID: r.ID, FullName: r.FullName, ProjectID: r.ProjectID}, nil
}

// UnlinkRepo removes the webhook and the repository's links.
func (s *Service) UnlinkRepo(ctx context.Context, user, ws, id uuid.UUID) error {
	if err := s.admin(ctx, user, ws); err != nil {
		return err
	}
	r, err := s.repo.RepoByID(ctx, id)
	if err != nil || r.WorkspaceID != ws {
		return apperr.New(domain.ErrRepoNotFound, "repository not linked")
	}
	if c, err := s.repo.Connection(ctx, ws); err == nil && r.HookID != nil {
		if token, err := s.token(c); err == nil {
			if err := s.gh.DeleteHook(ctx, token, r.FullName, *r.HookID); err != nil {
				s.log.Warn("github hook removal failed", slog.String("repo", r.FullName), slog.Any("err", err))
			}
		}
	}
	if err := s.repo.RemoveRepo(ctx, ws, id); err != nil {
		return err
	}
	s.hint(ctx, ws, nil)
	return nil
}

// --- cards

// Panel is what a card shows about GitHub.
type Panel struct {
	Active         bool // connected, enabled and the card's project has a repository
	Repo           string
	Branch         string
	Links          []domain.Link
	CanCreateIssue bool
}

func (s *Service) CardPanel(ctx context.Context, user, cardID uuid.UUID) (Panel, error) {
	card, err := s.cards.Get(ctx, user, cardID)
	if err != nil {
		return Panel{}, err
	}
	links, err := s.repo.CardLinks(ctx, cardID)
	if err != nil {
		return Panel{}, err
	}
	out := Panel{Links: links, Branch: domain.BranchName(card.Key, card.Title)}
	c, err := s.repo.Connection(ctx, card.WorkspaceID)
	if err != nil || !c.Enabled {
		return out, nil
	}
	r, err := s.repo.RepoByProject(ctx, card.ProjectID)
	if err != nil {
		return out, nil
	}
	out.Active, out.Repo = true, r.FullName
	out.CanCreateIssue = true
	for _, l := range links {
		if l.Kind == domain.Issue && l.RepoID == r.ID {
			out.CanCreateIssue = false
		}
	}
	return out, nil
}

// CreateIssue opens a GitHub issue for a card, in its project's repository, and links it.
func (s *Service) CreateIssue(ctx context.Context, user, cardID uuid.UUID) (domain.Link, error) {
	card, err := s.cards.Get(ctx, user, cardID)
	if err != nil {
		return domain.Link{}, err
	}
	if _, err := s.ws.Authorize(ctx, card.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		return domain.Link{}, err
	}
	c, err := s.repo.Connection(ctx, card.WorkspaceID)
	if err != nil {
		return domain.Link{}, err
	}
	r, err := s.repo.RepoByProject(ctx, card.ProjectID)
	if err != nil {
		return domain.Link{}, err
	}
	existing, err := s.repo.CardLinks(ctx, cardID)
	if err != nil {
		return domain.Link{}, err
	}
	for _, l := range existing {
		if l.Kind == domain.Issue && l.RepoID == r.ID {
			return l, nil
		}
	}
	token, err := s.token(c)
	if err != nil {
		return domain.Link{}, err
	}
	body := strings.TrimSpace(card.Description)
	if body != "" {
		body += "\n\n"
	}
	body += fmt.Sprintf("---\nCreated from task **%s** in LecodeKanban: %s/tasks?card=%s\n\n%s", card.Key, s.publicURL, card.ID, domain.IssueMarker(card.ID))
	issue, err := s.gh.CreateIssue(ctx, token, r.FullName, fmt.Sprintf("%s %s", card.Key, card.Title), body)
	if err != nil {
		return domain.Link{}, s.tokenError(ctx, err)
	}
	link, err := s.repo.SaveLink(ctx, domain.Link{CardID: cardID, RepoID: r.ID, RepoName: r.FullName, Kind: domain.Issue,
		Number: issue.Number, Title: issue.Title, State: domain.Open, URL: issue.URL})
	if err != nil {
		return domain.Link{}, err
	}
	s.hint(ctx, card.WorkspaceID, &cardID)
	return link, nil
}

// --- outbound: card changes reach GitHub

// OnCardMoved closes or reopens linked issues and comments on linked pull requests. Moves that came from
// GitHub itself (a merge) are not echoed back.
func (s *Service) OnCardMoved(ctx context.Context, e cardevents.CardMoved) error {
	if ctx.Value(fromGitHub{}) != nil || e.From == e.To {
		return nil
	}
	c, err := s.repo.Connection(ctx, e.WorkspaceID)
	if err != nil || !c.Enabled {
		return nil
	}
	links, err := s.repo.CardLinks(ctx, e.CardID)
	if err != nil || len(links) == 0 {
		return err
	}
	token, err := s.token(c)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("#%d", e.Number)
	if p, err := s.projects.Ref(ctx, e.ProjectID); err == nil {
		key = fmt.Sprintf("%s-%d", p.Key, e.Number)
	}
	detached := context.WithoutCancel(ctx)
	s.async(func() {
		ctx, cancel := context.WithTimeout(detached, 30*time.Second)
		defer cancel()
		for _, l := range links {
			switch l.Kind {
			case domain.Issue:
				if !c.Rules.SyncIssues {
					continue
				}
				closeIt := e.To == "done" && l.State != domain.Closed
				reopen := e.From == "done" && e.To != "done" && l.State == domain.Closed
				if !closeIt && !reopen {
					continue
				}
				if err := s.gh.SetIssueState(ctx, token, l.RepoName, l.Number, closeIt); err != nil {
					s.log.Warn("github issue update failed", slog.Any("err", err))
					continue
				}
				state := domain.Open
				if closeIt {
					state = domain.Closed
				}
				_ = s.repo.SetLinkState(ctx, l.RepoID, domain.Issue, l.Number, state)
			case domain.PR:
				if !c.Rules.CommentOnPR || l.State == domain.Merged || l.State == domain.Closed {
					continue
				}
				col := e.ColumnName
				if col == "" {
					col = e.To
				}
				msg := fmt.Sprintf("Task **%s** moved to **%s** in LecodeKanban: %s/tasks?card=%s", key, col, s.publicURL, e.CardID)
				if err := s.gh.Comment(ctx, token, l.RepoName, l.Number, msg); err != nil {
					s.log.Warn("github comment failed", slog.Any("err", err))
				}
			}
		}
		s.hint(ctx, e.WorkspaceID, &e.CardID)
	})
	return nil
}

// --- inbound: webhooks

type repoRef struct {
	FullName string `json:"full_name"`
}

type user struct {
	Login string `json:"login"`
}

type pullRequest struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	URL    string `json:"html_url"`
	Draft  bool   `json:"draft"`
	Merged bool   `json:"merged"`
	State  string `json:"state"`
	User   user   `json:"user"`
	Head   struct {
		Ref string `json:"ref"`
	} `json:"head"`
}

type issue struct {
	Number      int       `json:"number"`
	Title       string    `json:"title"`
	Body        string    `json:"body"`
	URL         string    `json:"html_url"`
	State       string    `json:"state"`
	User        user      `json:"user"`
	PullRequest *struct{} `json:"pull_request"`
}

type event struct {
	Action      string       `json:"action"`
	Repository  repoRef      `json:"repository"`
	PullRequest *pullRequest `json:"pull_request"`
	Issue       *issue       `json:"issue"`
}

// Verify checks the signature of a delivery against the workspace secret of the repository it names.
func (s *Service) verify(ctx context.Context, body []byte, signature string) (domain.Repo, domain.Connection, event, error) {
	var ev event
	if err := json.Unmarshal(body, &ev); err != nil || ev.Repository.FullName == "" {
		return domain.Repo{}, domain.Connection{}, ev, apperr.New(domain.ErrBadSignature, "unreadable delivery")
	}
	r, err := s.repo.RepoByName(ctx, ev.Repository.FullName)
	if err != nil {
		return domain.Repo{}, domain.Connection{}, ev, err
	}
	c, err := s.repo.Connection(ctx, r.WorkspaceID)
	if err != nil {
		return domain.Repo{}, domain.Connection{}, ev, err
	}
	secret, err := s.secret(c)
	if err != nil {
		return domain.Repo{}, domain.Connection{}, ev, err
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	want := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(want), []byte(signature)) {
		return domain.Repo{}, domain.Connection{}, ev, apperr.New(domain.ErrBadSignature, "bad signature")
	}
	return r, c, ev, nil
}

// Handle processes one webhook delivery. A delivery that fails the signature check, or names a repository
// that is not linked, is refused; ones that change nothing are accepted quietly.
func (s *Service) Handle(ctx context.Context, eventName, deliveryID string, body []byte, signature string) error {
	r, c, ev, err := s.verify(ctx, body, signature)
	if err != nil {
		return err
	}
	if deliveryID != "" {
		fresh, err := s.repo.FirstDelivery(ctx, deliveryID)
		if err != nil {
			return err
		}
		if !fresh {
			return nil
		}
	}
	if !c.Enabled || eventName == "ping" {
		return nil
	}
	ctx = context.WithValue(ctx, fromGitHub{}, true)
	switch eventName {
	case "pull_request":
		if ev.PullRequest != nil {
			return s.onPullRequest(ctx, r, c, ev.Action, *ev.PullRequest)
		}
	case "issues":
		if ev.Issue != nil && ev.Issue.PullRequest == nil {
			return s.onIssue(ctx, r, c, ev.Action, *ev.Issue)
		}
	}
	return nil
}

func prState(p pullRequest) domain.LinkState {
	switch {
	case p.Merged:
		return domain.Merged
	case p.State == "closed":
		return domain.Closed
	case p.Draft:
		return domain.Draft
	default:
		return domain.Open
	}
}

func (s *Service) move(ctx context.Context, c domain.Connection, card CardInfo, to string, onlyFrom ...string) {
	if card.Status == to {
		return
	}
	if len(onlyFrom) > 0 {
		ok := false
		for _, f := range onlyFrom {
			ok = ok || card.Status == f
		}
		if !ok {
			return
		}
	}
	if err := s.cards.MoveTo(ctx, c.ConnectedBy, card.ID, to); err != nil {
		s.log.Warn("github rule could not move a card", slog.String("card", card.ID.String()), slog.Any("err", err))
	}
}

func (s *Service) onPullRequest(ctx context.Context, r domain.Repo, c domain.Connection, action string, p pullRequest) error {
	keys := domain.ExtractKeys(p.Title, p.Head.Ref, p.Body)
	state := prState(p)
	for _, k := range keys {
		card, err := s.cards.FindByKey(ctx, r.WorkspaceID, k.Project, k.Number)
		if err != nil || card.WorkspaceID != r.WorkspaceID {
			continue
		}
		if _, err := s.repo.SaveLink(ctx, domain.Link{CardID: card.ID, RepoID: r.ID, RepoName: r.FullName, Kind: domain.PR, Number: p.Number,
			Title: p.Title, State: state, URL: p.URL, Author: p.User.Login}); err != nil {
			return err
		}
		switch {
		case (action == "opened" || action == "reopened" || action == "ready_for_review") && state == domain.Open && c.Rules.PROpenedToReview:
			s.move(ctx, c, card, "in_review", "todo", "in_progress")
		case action == "closed" && state == domain.Merged && c.Rules.PRMergedToDone:
			s.move(ctx, c, card, "done")
		}
		s.hint(ctx, r.WorkspaceID, &card.ID)
	}
	return nil
}

func (s *Service) onIssue(ctx context.Context, r domain.Repo, c domain.Connection, action string, i issue) error {
	if !c.Rules.SyncIssues {
		return nil
	}
	state := domain.Open
	if i.State == "closed" {
		state = domain.Closed
	}
	links, err := s.repo.RefLinks(ctx, r.ID, domain.Issue, i.Number)
	if err != nil {
		return err
	}
	if len(links) == 0 && action == "opened" {
		// An issue the app created itself names its card; anything else becomes a new card.
		if id, ok := domain.MarkedCard(i.Body); ok {
			if card, err := s.cards.Info(ctx, id); err == nil && card.WorkspaceID == r.WorkspaceID {
				_, err := s.repo.SaveLink(ctx, domain.Link{CardID: card.ID, RepoID: r.ID, RepoName: r.FullName, Kind: domain.Issue,
					Number: i.Number, Title: i.Title, State: state, URL: i.URL, Author: i.User.Login})
				return err
			}
		}
		desc := strings.TrimSpace(i.Body)
		if len(desc) > 4000 {
			desc = desc[:4000] + "…"
		}
		desc += fmt.Sprintf("\n\n[GitHub issue #%d](%s)", i.Number, i.URL)
		card, err := s.cards.Create(ctx, c.ConnectedBy, r.WorkspaceID, r.ProjectID, i.Title, strings.TrimSpace(desc))
		if err != nil {
			s.log.Warn("github issue could not become a card", slog.Any("err", err))
			return nil
		}
		if _, err := s.repo.SaveLink(ctx, domain.Link{CardID: card.ID, RepoID: r.ID, RepoName: r.FullName, Kind: domain.Issue,
			Number: i.Number, Title: i.Title, State: state, URL: i.URL, Author: i.User.Login}); err != nil {
			return err
		}
		s.hint(ctx, r.WorkspaceID, &card.ID)
		return nil
	}
	for _, l := range links {
		_ = s.repo.SetLinkState(ctx, r.ID, domain.Issue, i.Number, state)
		if _, err := s.repo.SaveLink(ctx, domain.Link{CardID: l.CardID, RepoID: r.ID, RepoName: r.FullName, Kind: domain.Issue,
			Number: i.Number, Title: i.Title, State: state, URL: i.URL, Author: i.User.Login}); err != nil {
			return err
		}
		card, err := s.cards.Info(ctx, l.CardID)
		if err != nil {
			continue
		}
		switch action {
		case "closed":
			s.move(ctx, c, card, "done")
		case "reopened":
			s.move(ctx, c, card, "todo", "done")
		}
		s.hint(ctx, r.WorkspaceID, &card.ID)
	}
	return nil
}
