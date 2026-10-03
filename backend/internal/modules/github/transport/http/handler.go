// Package http exposes the GitHub integration and its webhook.
package http

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/github", httpx.H(h.get))
	r.Patch("/workspaces/{workspaceId}/github", httpx.H(h.update))
	r.Delete("/workspaces/{workspaceId}/github", httpx.H(h.disconnect))
	r.Put("/workspaces/{workspaceId}/github/token", httpx.H(h.connect))
	r.Get("/workspaces/{workspaceId}/github/repos/available", httpx.H(h.available))
	r.Post("/workspaces/{workspaceId}/github/repos", httpx.H(h.link))
	r.Delete("/workspaces/{workspaceId}/github/repos/{repoId}", httpx.H(h.unlink))
	r.Get("/cards/{cardId}/github", httpx.H(h.panel))
	r.Post("/cards/{cardId}/github/issue", httpx.H(h.issue))
}

// PublicRoutes holds the webhook: GitHub is not signed in, the HMAC signature is the credential.
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Post("/integrations/github/webhook", httpx.H(h.webhook))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func param(r *http.Request, name string, code apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(code, "not found")
	}
	return id, nil
}

func summary(s service.Summary) api.GithubSummary {
	out := api.GithubSummary{Connected: s.Connected, Enabled: s.Enabled, Account: s.Account, WebhookUrl: s.WebhookURL, CanManage: s.CanManage,
		Rules: api.GithubRules{PrOpenedToReview: s.Rules.PROpenedToReview, PrMergedToDone: s.Rules.PRMergedToDone,
			SyncIssues: s.Rules.SyncIssues, CommentOnPr: s.Rules.CommentOnPR},
		Repos: make([]api.GithubRepo, len(s.Repos))}
	for i, r := range s.Repos {
		out.Repos[i] = api.GithubRepo{Id: r.ID, FullName: r.FullName, ProjectId: r.ProjectID}
	}
	return out
}

func link(l domain.Link) api.GithubLink {
	return api.GithubLink{Id: l.ID, Kind: api.GithubLinkKind(l.Kind), Number: l.Number, Title: l.Title, State: api.GithubLinkState(l.State),
		Url: l.URL, Repo: l.RepoName, Author: l.Author}
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	s, err := h.svc.Summary(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, summary(s))
	return nil
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.GithubPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	s, err := h.svc.UpdateRules(r.Context(), userID(r), ws, service.RulesPatch{Enabled: in.Enabled, PROpenedToReview: in.PrOpenedToReview,
		PRMergedToDone: in.PrMergedToDone, SyncIssues: in.SyncIssues, CommentOnPR: in.CommentOnPr})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, summary(s))
	return nil
}

func (h *Handler) disconnect(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Disconnect(r.Context(), userID(r), ws); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) connect(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.GithubTokenInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	s, err := h.svc.Connect(r.Context(), userID(r), ws, in.Token)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, summary(s))
	return nil
}

func (h *Handler) available(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	names, err := h.svc.AvailableRepos(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	if names == nil {
		names = []string{}
	}
	httpx.WriteJSON(w, http.StatusOK, api.GithubRepoNames{Items: names})
	return nil
}

func (h *Handler) link(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.GithubRepoInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.LinkRepo(r.Context(), userID(r), ws, in.ProjectId, in.Repo)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, api.GithubRepo{Id: v.ID, FullName: v.FullName, ProjectId: v.ProjectID})
	return nil
}

func (h *Handler) unlink(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	id, err := param(r, "repoId", domain.ErrRepoNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.UnlinkRepo(r.Context(), userID(r), ws, id); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) panel(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	p, err := h.svc.CardPanel(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := api.GithubPanel{Active: p.Active, Repo: p.Repo, Branch: p.Branch, CanCreateIssue: p.CanCreateIssue, Links: make([]api.GithubLink, len(p.Links))}
	for i, l := range p.Links {
		out.Links[i] = link(l)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) issue(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	l, err := h.svc.CreateIssue(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, link(l))
	return nil
}

const maxPayload = 5 << 20

func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, maxPayload+1))
	if err != nil || len(body) > maxPayload {
		return apperr.New(domain.ErrBadSignature, "unreadable delivery")
	}
	err = h.svc.Handle(r.Context(), r.Header.Get("X-GitHub-Event"), r.Header.Get("X-GitHub-Delivery"), body, r.Header.Get("X-Hub-Signature-256"))
	if err != nil {
		if apperr.IsCode(err, domain.ErrRepoNotFound) {
			// A repository that is not linked: nothing to do, and no hint about which ones are.
			w.WriteHeader(http.StatusNoContent)
			return nil
		}
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
