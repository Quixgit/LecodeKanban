package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
)

// index holds a whole space in memory so many nodes can be resolved with two queries; it backs
// the tree and every list that must be filtered by access.
type index struct {
	space  domain.Space
	nodes  map[uuid.UUID]domain.Node
	order  []domain.Node // depth, rank — as stored
	grants map[uuid.UUID][]domain.Grant
}

func (s *Service) buildIndex(ctx context.Context, sp domain.Space) (*index, error) {
	return loadIndex(ctx, s.repo, sp)
}

func loadIndex(ctx context.Context, repo *repository.Repo, sp domain.Space) (*index, error) {
	rows, err := repo.SpaceNodes(ctx, sp.ID)
	if err != nil {
		return nil, err
	}
	perms, err := repo.SpacePermissions(ctx, sp.ID)
	if err != nil {
		return nil, err
	}
	ix := &index{space: sp, nodes: make(map[uuid.UUID]domain.Node, len(rows)), order: rows, grants: toGrants(perms)}
	for _, n := range rows {
		ix.nodes[n.ID] = n
	}
	return ix, nil
}

func (ix *index) chain(n domain.Node) []domain.Element {
	rev := []domain.Element{nodeElement(n, ix.grants[n.ID])}
	for p := n.ParentID; p != nil; {
		parent, ok := ix.nodes[*p]
		if !ok {
			break
		}
		rev = append(rev, nodeElement(parent, ix.grants[parent.ID]))
		p = parent.ParentID
	}
	out := make([]domain.Element, 0, len(rev)+1)
	out = append(out, spaceElement(ix.space, ix.grants[uuid.Nil]))
	for i := len(rev) - 1; i >= 0; i-- {
		out = append(out, rev[i])
	}
	return out
}

func (ix *index) access(sub domain.Subject, n domain.Node) domain.Access {
	return domain.Resolve(sub, ix.chain(n))
}

// indexes lazily builds one index per space for a request.
type indexes struct {
	s   *Service
	m   map[uuid.UUID]*index
	sps map[uuid.UUID]domain.Space
}

func (s *Service) newIndexes() *indexes {
	return &indexes{s: s, m: map[uuid.UUID]*index{}, sps: map[uuid.UUID]domain.Space{}}
}

func (x *indexes) of(ctx context.Context, spaceID uuid.UUID) (*index, error) {
	if ix, ok := x.m[spaceID]; ok {
		return ix, nil
	}
	sp, err := x.s.repo.Space(ctx, spaceID)
	if err != nil {
		return nil, err
	}
	ix, err := x.s.buildIndex(ctx, sp)
	if err != nil {
		return nil, err
	}
	x.m[spaceID] = ix
	return ix, nil
}

// NodeView is a node with the caller's access to it.
type NodeView struct {
	Node     domain.Node
	Access   domain.Access
	Favorite bool
	// ProjectIDs are the linked projects; filled for single-node reads only.
	ProjectIDs []uuid.UUID
}

// filter keeps the nodes the caller can see at min role, resolved against each node's own space.
func (x *indexes) filter(ctx context.Context, sub domain.Subject, nodes []domain.Node, min domain.Role) ([]NodeView, error) {
	out := make([]NodeView, 0, len(nodes))
	for _, n := range nodes {
		ix, err := x.of(ctx, n.SpaceID)
		if err != nil {
			return nil, err
		}
		if a := ix.access(sub, n); a.Role.AtLeast(min) {
			out = append(out, NodeView{Node: n, Access: a})
		}
	}
	return out, nil
}
