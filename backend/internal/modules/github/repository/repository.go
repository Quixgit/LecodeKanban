// Package repository persists the GitHub connection, linked repositories and card links.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct{ q *store.Queries }

func New(pool *pgxpool.Pool) *Repo { return &Repo{q: store.New(pool)} }

func toConn(c store.GithubConnection) domain.Connection {
	return domain.Connection{WorkspaceID: c.WorkspaceID, ConnectedBy: c.ConnectedBy, AccountLogin: c.AccountLogin,
		Token: c.TokenEnc, WebhookSecret: c.WebhookSecretEnc, Enabled: c.Enabled,
		Rules: domain.Rules{PROpenedToReview: c.PrOpenedToReview, PRMergedToDone: c.PrMergedToDone, SyncIssues: c.SyncIssues,
			CommentOnPR: c.CommentOnPr}}
}

func toRepo(r store.GithubRepo) domain.Repo {
	return domain.Repo{ID: r.ID, WorkspaceID: r.WorkspaceID, ProjectID: r.ProjectID, FullName: r.FullName, HookID: hookID(r.HookID)}
}

func toLink(l store.GithubLink, repo string) domain.Link {
	return domain.Link{ID: l.ID, CardID: l.CardID, RepoID: l.RepoID, RepoName: repo, Kind: domain.LinkKind(l.Kind),
		Number: int(l.Number), Title: l.Title, State: domain.LinkState(l.State), URL: l.Url, Author: l.Author, Updated: l.UpdatedAt}
}

func missing(err error) error {
	if err == pgx.ErrNoRows {
		return apperr.New(domain.ErrNotConnected, "not connected")
	}
	return err
}

func (r *Repo) Connect(ctx context.Context, ws, by uuid.UUID, login string, token, secret []byte) (domain.Connection, error) {
	c, err := r.q.UpsertConnection(ctx, store.UpsertConnectionParams{WorkspaceID: ws, ConnectedBy: by, AccountLogin: login,
		TokenEnc: token, WebhookSecretEnc: secret})
	if err != nil {
		return domain.Connection{}, err
	}
	return toConn(c), nil
}

func (r *Repo) Connection(ctx context.Context, ws uuid.UUID) (domain.Connection, error) {
	c, err := r.q.GetConnection(ctx, ws)
	if err != nil {
		return domain.Connection{}, missing(err)
	}
	return toConn(c), nil
}

func (r *Repo) UpdateRules(ctx context.Context, ws uuid.UUID, enabled bool, rules domain.Rules) (domain.Connection, error) {
	c, err := r.q.UpdateRules(ctx, store.UpdateRulesParams{WorkspaceID: ws, Enabled: enabled, PrOpenedToReview: rules.PROpenedToReview,
		PrMergedToDone: rules.PRMergedToDone, SyncIssues: rules.SyncIssues, CommentOnPr: rules.CommentOnPR})
	if err != nil {
		return domain.Connection{}, missing(err)
	}
	return toConn(c), nil
}

func (r *Repo) Disconnect(ctx context.Context, ws uuid.UUID) error {
	return r.q.DeleteConnection(ctx, ws)
}

func (r *Repo) AddRepo(ctx context.Context, ws, project uuid.UUID, full string, hook *int64) (domain.Repo, error) {
	row, err := r.q.InsertRepo(ctx, store.InsertRepoParams{WorkspaceID: ws, ProjectID: project, FullName: full, HookID: nullHook(hook)})
	if err != nil {
		if db.IsUniqueViolation(err, "") {
			return domain.Repo{}, apperr.New(domain.ErrRepoLinked, "already linked")
		}
		return domain.Repo{}, err
	}
	return toRepo(row), nil
}

func (r *Repo) Repos(ctx context.Context, ws uuid.UUID) ([]domain.Repo, error) {
	rows, err := r.q.ListRepos(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Repo, len(rows))
	for i, x := range rows {
		out[i] = toRepo(x)
	}
	return out, nil
}

func (r *Repo) RepoByID(ctx context.Context, id uuid.UUID) (domain.Repo, error) {
	row, err := r.q.GetRepo(ctx, id)
	if err != nil {
		return domain.Repo{}, apperr.New(domain.ErrRepoNotFound, "repository not linked")
	}
	return toRepo(row), nil
}

func (r *Repo) RepoByName(ctx context.Context, full string) (domain.Repo, error) {
	row, err := r.q.GetRepoByName(ctx, full)
	if err != nil {
		return domain.Repo{}, apperr.New(domain.ErrRepoNotFound, "repository not linked")
	}
	return toRepo(row), nil
}

func (r *Repo) RepoByProject(ctx context.Context, project uuid.UUID) (domain.Repo, error) {
	row, err := r.q.GetRepoByProject(ctx, project)
	if err != nil {
		return domain.Repo{}, apperr.New(domain.ErrProjectNotSet, "project has no repository")
	}
	return toRepo(row), nil
}

func (r *Repo) RemoveRepo(ctx context.Context, ws, id uuid.UUID) error {
	return r.q.DeleteRepo(ctx, store.DeleteRepoParams{ID: id, WorkspaceID: ws})
}

func (r *Repo) SaveLink(ctx context.Context, l domain.Link) (domain.Link, error) {
	row, err := r.q.UpsertLink(ctx, store.UpsertLinkParams{CardID: l.CardID, RepoID: l.RepoID, Kind: string(l.Kind), Number: int32(l.Number),
		Title: l.Title, State: string(l.State), Url: l.URL, Author: l.Author})
	if err != nil {
		return domain.Link{}, err
	}
	return toLink(row, l.RepoName), nil
}

func (r *Repo) CardLinks(ctx context.Context, card uuid.UUID) ([]domain.Link, error) {
	rows, err := r.q.LinksForCard(ctx, card)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Link, len(rows))
	for i, x := range rows {
		out[i] = domain.Link{ID: x.ID, CardID: x.CardID, RepoID: x.RepoID, RepoName: x.FullName, Kind: domain.LinkKind(x.Kind),
			Number: int(x.Number), Title: x.Title, State: domain.LinkState(x.State), URL: x.Url, Author: x.Author, Updated: x.UpdatedAt}
	}
	return out, nil
}

func (r *Repo) RefLinks(ctx context.Context, repo uuid.UUID, kind domain.LinkKind, number int) ([]domain.Link, error) {
	rows, err := r.q.LinksForRef(ctx, store.LinksForRefParams{RepoID: repo, Kind: string(kind), Number: int32(number)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Link, len(rows))
	for i, x := range rows {
		out[i] = toLink(x, "")
	}
	return out, nil
}

func (r *Repo) SetLinkState(ctx context.Context, repo uuid.UUID, kind domain.LinkKind, number int, state domain.LinkState) error {
	return r.q.SetLinkState(ctx, store.SetLinkStateParams{RepoID: repo, Kind: string(kind), Number: int32(number), State: string(state)})
}

// FirstDelivery records a delivery id and reports whether it is new.
func (r *Repo) FirstDelivery(ctx context.Context, id string) (bool, error) {
	_, err := r.q.ClaimDelivery(ctx, id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	_ = r.q.PruneDeliveries(ctx, time.Now().Add(-14*24*time.Hour))
	return true, nil
}

func hookID(v pgtype.Int8) *int64 {
	if !v.Valid {
		return nil
	}
	return &v.Int64
}

func nullHook(v *int64) pgtype.Int8 {
	if v == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *v, Valid: true}
}
