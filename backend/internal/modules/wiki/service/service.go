// Package service implements the wiki use cases. Every operation resolves the caller's effective
// access through domain.Resolve before touching data; elements the caller may not know exist
// answer wiki.not_found, never forbidden (docs/adr/0014).
package service

import (
	"context"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"

	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Workspaces is the workspace RBAC the wiki builds on (workspaces.Service satisfies it).
type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

// Teams resolves team membership for grants. The product has no teams yet; the adapter in
// cmd/server/wire.go answers "none" until it does (docs/adr/0014).
type Teams interface {
	TeamsOf(ctx context.Context, ws, user uuid.UUID) ([]uuid.UUID, error)
	Exists(ctx context.Context, ws, team uuid.UUID) (bool, error)
}

// Projects lets pages link to projects (projects.Service satisfies it).
type Projects interface {
	Refs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]projectsdomain.Ref, error)
}

// Storage keeps uploaded bytes (the attachments disk store satisfies it).
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, max int64) (int64, error)
	Open(ctx context.Context, key string) (io.ReadSeekCloser, error)
	Delete(ctx context.Context, key string) error
}

type Service struct {
	repo     *repository.Repo
	ws       Workspaces
	teams    Teams
	projects Projects
	storage  Storage
	maxBytes int64
	now      func() time.Time
}

// Option configures optional collaborators; the service works without them (no project links,
// no uploads) so it stays easy to construct in tests and tools.
type Option func(*Service)

func WithProjects(p Projects) Option { return func(s *Service) { s.projects = p } }

func WithFiles(st Storage, maxBytes int64) Option {
	return func(s *Service) { s.storage, s.maxBytes = st, maxBytes }
}

func New(repo *repository.Repo, ws Workspaces, teams Teams, opts ...Option) *Service {
	s := &Service{repo: repo, ws: ws, teams: teams, now: time.Now}
	for _, o := range opts {
		o(s)
	}
	return s
}

// MaxUploadBytes is the per-file upload limit.
func (s *Service) MaxUploadBytes() int64 { return s.maxBytes }

// subject describes the caller within a workspace. Non-members get wiki.not_found.
func (s *Service) subject(ctx context.Context, ws, user uuid.UUID) (domain.Subject, error) {
	role, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView)
	if err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Subject{}, apperr.New(domain.ErrNotFound, "wiki element not found")
		}
		return domain.Subject{}, err
	}
	teams, err := s.teams.TeamsOf(ctx, ws, user)
	if err != nil {
		return domain.Subject{}, err
	}
	return domain.Subject{UserID: user, Teams: teams, WorkspaceRole: role.Role}, nil
}

// label names one chain link for "inherited from" summaries.
type label struct {
	ID    uuid.UUID
	Kind  string // "space" or "node"
	Title string
}

// scope is a loaded element with its chain and the caller's resolved access.
type scope struct {
	space  domain.Space
	node   *domain.Node // nil when the element is the space itself
	chain  []domain.Element
	labels []label
	sub    domain.Subject
	access domain.Access
}

func (sc *scope) id() uuid.UUID {
	if sc.node != nil {
		return sc.node.ID
	}
	return sc.space.ID
}

func (sc *scope) nodeID() *uuid.UUID {
	if sc.node == nil {
		return nil
	}
	id := sc.node.ID
	return &id
}

// need enforces a capability: no access at all is not_found, too little is forbidden.
func (sc *scope) need(c domain.Capability) error {
	if sc.access.Role == "" {
		return apperr.New(domain.ErrNotFound, "wiki element not found")
	}
	if !sc.access.Role.Can(c) {
		return apperr.New(domain.ErrForbidden, "insufficient wiki role")
	}
	return nil
}

func spaceElement(sp domain.Space, grants []domain.Grant) domain.Element {
	return domain.Element{ID: sp.ID, Visibility: sp.Visibility, WorkspaceRole: sp.WorkspaceRole, OwnerID: sp.OwnerID, Grants: grants}
}

func nodeElement(n domain.Node, grants []domain.Grant) domain.Element {
	return domain.Element{ID: n.ID, Visibility: n.Visibility, WorkspaceRole: n.WorkspaceRole, OwnerID: n.OwnerID, Grants: grants}
}

func toGrants(ps []domain.Permission) map[uuid.UUID][]domain.Grant {
	out := map[uuid.UUID][]domain.Grant{}
	for _, p := range ps {
		var key uuid.UUID
		if p.NodeID != nil {
			key = *p.NodeID
		}
		out[key] = append(out[key], domain.Grant{Kind: p.PrincipalKind, PrincipalID: p.PrincipalID, Role: p.Role})
	}
	return out
}

func (s *Service) loadSpace(ctx context.Context, user, spaceID uuid.UUID) (*scope, error) {
	sp, err := s.repo.Space(ctx, spaceID)
	if err != nil {
		return nil, err
	}
	sub, err := s.subject(ctx, sp.WorkspaceID, user)
	if err != nil {
		return nil, err
	}
	perms, err := s.repo.ChainPermissions(ctx, sp.ID, nil)
	if err != nil {
		return nil, err
	}
	g := toGrants(perms)
	sc := &scope{space: sp, sub: sub, chain: []domain.Element{spaceElement(sp, g[uuid.Nil])},
		labels: []label{{ID: sp.ID, Kind: "space", Title: sp.Name}}}
	sc.access = domain.Resolve(sub, sc.chain)
	return sc, nil
}

// loadNode loads a node with its ancestors. Trashed nodes are not found unless deleted is set.
func (s *Service) loadNode(ctx context.Context, user, nodeID uuid.UUID, deleted bool) (*scope, error) {
	n, err := s.repo.Node(ctx, nodeID)
	if err != nil {
		return nil, err
	}
	if n.Deleted() && !deleted {
		return nil, apperr.New(domain.ErrNotFound, "wiki element not found")
	}
	sub, err := s.subject(ctx, n.WorkspaceID, user)
	if err != nil {
		return nil, err
	}
	sp, err := s.repo.Space(ctx, n.SpaceID)
	if err != nil {
		return nil, err
	}
	ids := pathIDs(n.Path)
	rows, err := s.repo.Nodes(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]domain.Node, len(rows))
	for _, r := range rows {
		byID[r.ID] = r
	}
	perms, err := s.repo.ChainPermissions(ctx, sp.ID, ids)
	if err != nil {
		return nil, err
	}
	g := toGrants(perms)
	sc := &scope{space: sp, node: &n, sub: sub, chain: []domain.Element{spaceElement(sp, g[uuid.Nil])},
		labels: []label{{ID: sp.ID, Kind: "space", Title: sp.Name}}}
	for _, id := range ids { // root → node; ancestors purged earlier are simply absent
		if a, ok := byID[id]; ok {
			sc.chain = append(sc.chain, nodeElement(a, g[a.ID]))
			sc.labels = append(sc.labels, label{ID: a.ID, Kind: "node", Title: a.Title})
		}
	}
	sc.access = domain.Resolve(sub, sc.chain)
	return sc, nil
}

func pathIDs(path string) []uuid.UUID {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	out := make([]uuid.UUID, 0, len(parts))
	for _, p := range parts {
		if id, err := uuid.Parse(p); err == nil {
			out = append(out, id)
		}
	}
	return out
}

func (s *Service) audit(ctx context.Context, r *repository.Repo, ws uuid.UUID, space, node *uuid.UUID, actor uuid.UUID, kind string, data map[string]any) error {
	return r.Audit(ctx, domain.AuditEvent{WorkspaceID: ws, SpaceID: space, NodeID: node, ActorID: &actor, Kind: kind, Data: data})
}
