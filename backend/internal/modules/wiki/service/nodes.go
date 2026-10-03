package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// TreeNode is one entry of a space tree. Detached nodes are visible to the caller although their
// parent is not: clients show them under "Shared with me" instead of in the tree.
type TreeNode struct {
	NodeView
	Detached bool
}

// Tree is a space with every node the caller may see; the rest is omitted entirely.
type Tree struct {
	Space  domain.Space
	Access domain.Access
	Nodes  []TreeNode
}

// Tree returns the nodes of a space visible to the caller, in tree order (depth, rank).
func (s *Service) Tree(ctx context.Context, user, spaceID uuid.UUID) (Tree, error) {
	sc, err := s.loadSpace(ctx, user, spaceID)
	if err != nil {
		return Tree{}, err
	}
	ix, err := s.buildIndex(ctx, sc.space)
	if err != nil {
		return Tree{}, err
	}
	favs, err := s.repo.FavoriteIDs(ctx, user, spaceID)
	if err != nil {
		return Tree{}, err
	}
	access := make(map[uuid.UUID]domain.Access, len(ix.order))
	for _, n := range ix.order {
		if !n.Deleted() {
			access[n.ID] = ix.access(sc.sub, n)
		}
	}
	out := Tree{Space: sc.space, Access: sc.access, Nodes: []TreeNode{}}
	for _, n := range ix.order {
		a, live := access[n.ID]
		if !live || !a.Role.AtLeast(domain.RoleViewer) {
			continue
		}
		detached := n.ParentID != nil && !access[*n.ParentID].Role.AtLeast(domain.RoleViewer)
		out.Nodes = append(out.Nodes, TreeNode{NodeView: NodeView{Node: n, Access: a, Favorite: favs[n.ID]}, Detached: detached})
	}
	if !sc.access.Role.AtLeast(domain.RoleViewer) && len(out.Nodes) == 0 {
		return Tree{}, apperr.New(domain.ErrNotFound, "wiki element not found")
	}
	return out, nil
}

// NodeInput creates a node; AfterID places it right after that sibling (default: last).
type NodeInput struct {
	ParentID *uuid.UUID
	Kind     domain.Kind
	Title    string
	Icon     string
	AfterID  *uuid.UUID
}

func validateTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	var v validation.V
	if v.Required("title", title) {
		v.Length("title", title, 1, domain.MaxTitle)
	}
	return title, v.Err()
}

// rankBetween picks a key for a node placed among siblings (which exclude the node itself).
func rankBetween(sibs []domain.Node, before, after *uuid.UUID) (string, error) {
	find := func(id uuid.UUID) int {
		for i, n := range sibs {
			if n.ID == id {
				return i
			}
		}
		return -1
	}
	var prev, next string
	switch {
	case after != nil:
		i := find(*after)
		if i < 0 {
			return "", apperr.New(domain.ErrBadPlacement, "reference node is not a sibling")
		}
		prev = sibs[i].Rank
		if i+1 < len(sibs) {
			next = sibs[i+1].Rank
		}
	case before != nil:
		i := find(*before)
		if i < 0 {
			return "", apperr.New(domain.ErrBadPlacement, "reference node is not a sibling")
		}
		next = sibs[i].Rank
		if i > 0 {
			prev = sibs[i-1].Rank
		}
	default:
		if len(sibs) > 0 {
			prev = sibs[len(sibs)-1].Rank
		}
	}
	if next != "" && prev >= next { // ties from old data: land after the tie group
		next = ""
	}
	return fractional.BetweenUnique(prev, next)
}

func without(sibs []domain.Node, id uuid.UUID) []domain.Node {
	out := make([]domain.Node, 0, len(sibs))
	for _, n := range sibs {
		if n.ID != id {
			out = append(out, n)
		}
	}
	return out
}

// CreateNode adds a folder or page under a parent (or at the space root).
func (s *Service) CreateNode(ctx context.Context, user, spaceID uuid.UUID, in NodeInput) (NodeView, error) {
	title, err := validateTitle(in.Title)
	if err != nil {
		return NodeView{}, err
	}
	if !in.Kind.Valid() {
		var v validation.V
		v.Add("kind", validation.OneOf, map[string]any{"allowed": []string{"folder", "page"}})
		return NodeView{}, v.Err()
	}
	var sc *scope
	parentPath, depth := "/", 1
	if in.ParentID == nil {
		sc, err = s.loadSpace(ctx, user, spaceID)
	} else {
		sc, err = s.loadNode(ctx, user, *in.ParentID, false)
		if err == nil && sc.space.ID != spaceID {
			err = apperr.New(domain.ErrNotFound, "wiki element not found")
		}
		if err == nil {
			parentPath, depth = sc.node.Path, sc.node.Depth+1
		}
	}
	if err != nil {
		return NodeView{}, err
	}
	if err := sc.need(domain.CapEdit); err != nil {
		return NodeView{}, err
	}
	if depth > sc.space.MaxDepth {
		return NodeView{}, apperr.New(domain.ErrMaxDepth, "maximum nesting depth reached").WithMeta("max", sc.space.MaxDepth)
	}
	var n domain.Node
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		sibs, err := r.Siblings(ctx, spaceID, in.ParentID)
		if err != nil {
			return err
		}
		rank, err := rankBetween(sibs, nil, in.AfterID)
		if err != nil {
			return err
		}
		id := uuid.New()
		if n, err = r.CreateNode(ctx, repository.NewNode{ID: id, WorkspaceID: sc.space.WorkspaceID, SpaceID: spaceID,
			ParentID: in.ParentID, Kind: in.Kind, Title: title, Icon: in.Icon, Rank: rank, Path: parentPath + id.String() + "/",
			Depth: depth, OwnerID: user}); err != nil {
			return err
		}
		return s.audit(ctx, r, n.WorkspaceID, &spaceID, &n.ID, user, domain.AuditNodeCreated,
			map[string]any{"title": n.Title, "kind": string(n.Kind), "parentId": in.ParentID})
	})
	if err != nil {
		return NodeView{}, err
	}
	chain := append(append([]domain.Element{}, sc.chain...), nodeElement(n, nil))
	return NodeView{Node: n, Access: domain.Resolve(sc.sub, chain)}, nil
}

// Node returns one node and records it in the caller's recents.
func (s *Service) Node(ctx context.Context, user, id uuid.UUID) (NodeView, error) {
	sc, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return NodeView{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return NodeView{}, err
	}
	if err := s.repo.TouchRecent(ctx, user, id); err != nil {
		return NodeView{}, err
	}
	favs, err := s.repo.FavoriteIDs(ctx, user, sc.space.ID)
	if err != nil {
		return NodeView{}, err
	}
	return NodeView{Node: *sc.node, Access: sc.access, Favorite: favs[id]}, nil
}

// NodePatch updates a node's title, icon or cover; nil leaves a field as is.
type NodePatch struct {
	Title, Icon, Cover *string
}

func (s *Service) UpdateNode(ctx context.Context, user, id uuid.UUID, p NodePatch) (NodeView, error) {
	sc, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return NodeView{}, err
	}
	if err := sc.need(domain.CapEdit); err != nil {
		return NodeView{}, err
	}
	n := *sc.node
	title := n.Title
	if p.Title != nil {
		if title, err = validateTitle(*p.Title); err != nil {
			return NodeView{}, err
		}
	}
	icon, cover := n.Icon, n.Cover
	if p.Icon != nil {
		icon = *p.Icon
	}
	if p.Cover != nil {
		cover = *p.Cover
	}
	var v validation.V
	v.IconKey("icon", icon)
	v.Length("cover", cover, 0, 200)
	if err := v.Err(); err != nil {
		return NodeView{}, err
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if n, err = r.UpdateNodeMeta(ctx, id, title, icon, cover); err != nil {
			return err
		}
		if title != sc.node.Title {
			return s.audit(ctx, r, n.WorkspaceID, &n.SpaceID, &n.ID, user, domain.AuditNodeRenamed,
				map[string]any{"from": sc.node.Title, "to": title})
		}
		return nil
	})
	if err != nil {
		return NodeView{}, err
	}
	return NodeView{Node: n, Access: sc.access}, nil
}

// MoveInput places a node. ParentID nil means the root of SpaceID (default: the current space).
// BeforeID/AfterID pick the position among the new siblings (default: last).
type MoveInput struct {
	SpaceID      *uuid.UUID
	ParentID     *uuid.UUID
	BeforeID     *uuid.UUID
	AfterID      *uuid.UUID
	ConfirmWiden bool
}

// MoveNode re-parents or reorders a subtree. Moving checks edit rights on the node and the
// destination, cycles, the depth limit, and asks for confirmation when the new location would let
// more people read the page (ErrConfirmWiden; resend with ConfirmWiden).
func (s *Service) MoveNode(ctx context.Context, user, id uuid.UUID, in MoveInput) (NodeView, error) {
	src, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return NodeView{}, err
	}
	if err := src.need(domain.CapEdit); err != nil {
		return NodeView{}, err
	}
	n := *src.node

	var dest *scope
	var destParentPath string
	destDepth := 1
	destSpace := n.SpaceID
	if in.SpaceID != nil {
		destSpace = *in.SpaceID
	}
	if in.ParentID != nil {
		if dest, err = s.loadNode(ctx, user, *in.ParentID, false); err != nil {
			return NodeView{}, err
		}
		if in.SpaceID != nil && *in.SpaceID != dest.space.ID {
			return NodeView{}, apperr.New(domain.ErrBadPlacement, "parent belongs to another space")
		}
		if strings.HasPrefix(dest.node.Path, n.Path) {
			return NodeView{}, apperr.New(domain.ErrCycle, "cannot move a node into its own subtree")
		}
		destParentPath, destDepth = dest.node.Path, dest.node.Depth+1
	} else {
		if dest, err = s.loadSpace(ctx, user, destSpace); err != nil {
			return NodeView{}, err
		}
		destParentPath = "/"
	}
	if dest.space.WorkspaceID != n.WorkspaceID {
		return NodeView{}, apperr.New(domain.ErrNotFound, "wiki element not found")
	}
	if err := dest.need(domain.CapEdit); err != nil {
		return NodeView{}, err
	}
	deepest, err := s.repo.SubtreeMaxDepth(ctx, n.Path)
	if err != nil {
		return NodeView{}, err
	}
	if destDepth+(deepest-n.Depth) > dest.space.MaxDepth {
		return NodeView{}, apperr.New(domain.ErrMaxDepth, "maximum nesting depth reached").WithMeta("max", dest.space.MaxDepth)
	}

	sameParent := n.SpaceID == dest.space.ID && sameID(n.ParentID, in.ParentID)
	if !sameParent && !in.ConfirmWiden {
		after := domain.AudienceOf(append(append([]domain.Element{}, dest.chain...), nodeElement(n, src.chain[len(src.chain)-1].Grants)))
		if after.WidensComparedTo(domain.AudienceOf(src.chain)) {
			return NodeView{}, apperr.New(domain.ErrConfirmWiden, "the new location is more widely accessible").
				WithMeta("visibility", string(after.Visibility)).
				WithMeta("destination", dest.labels[len(dest.labels)-1].Title)
		}
	}

	var placed domain.Node
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		sibs, err := r.Siblings(ctx, dest.space.ID, in.ParentID)
		if err != nil {
			return err
		}
		rank, err := rankBetween(without(sibs, n.ID), in.BeforeID, in.AfterID)
		if err != nil {
			return err
		}
		if placed, err = r.Place(ctx, n, dest.space.ID, in.ParentID, rank, destParentPath, destDepth); err != nil {
			return err
		}
		return s.audit(ctx, r, n.WorkspaceID, &dest.space.ID, &n.ID, user, domain.AuditNodeMoved, map[string]any{
			"title": n.Title, "fromSpaceId": n.SpaceID, "fromParentId": n.ParentID,
			"toSpaceId": dest.space.ID, "toParentId": in.ParentID, "widened": !sameParent && in.ConfirmWiden,
		})
	})
	if err != nil {
		return NodeView{}, err
	}
	moved, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return NodeView{}, err
	}
	return NodeView{Node: placed, Access: moved.access}, nil
}

func sameID(a, b *uuid.UUID) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// DeleteNode moves a node and its subtree to the trash (restorable for 30 days).
func (s *Service) DeleteNode(ctx context.Context, user, id uuid.UUID) error {
	sc, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return err
	}
	if err := sc.need(domain.CapEdit); err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.Trash(ctx, *sc.node, user); err != nil {
			return err
		}
		return s.audit(ctx, r, sc.node.WorkspaceID, &sc.space.ID, &id, user, domain.AuditNodeDeleted, map[string]any{"title": sc.node.Title})
	})
}

// TrashItem is a deleted subtree root with when it disappears for good.
type TrashItem struct {
	NodeView
}

// Trash lists deleted subtrees the caller may restore (editor or above), newest first.
func (s *Service) Trash(ctx context.Context, user, ws uuid.UUID) ([]TrashItem, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	roots, err := s.repo.TrashRoots(ctx, ws, s.now().Add(-domain.TrashRetention))
	if err != nil {
		return nil, err
	}
	views, err := s.newIndexes().filter(ctx, sub, roots, domain.RoleEditor)
	if err != nil {
		return nil, err
	}
	out := make([]TrashItem, len(views))
	for i, v := range views {
		out[i] = TrashItem{v}
	}
	return out, nil
}

// RestoreNode brings a trashed subtree back where it was, or to the space root when its parent is
// gone. A node that inherited its visibility keeps its effective visibility when relocated, so
// restoring never silently widens access.
func (s *Service) RestoreNode(ctx context.Context, user, id uuid.UUID) (NodeView, error) {
	sc, err := s.loadNode(ctx, user, id, true)
	if err != nil {
		return NodeView{}, err
	}
	n := *sc.node
	if err := sc.need(domain.CapEdit); err != nil {
		return NodeView{}, err
	}
	if n.TrashRootID == nil || *n.TrashRootID != n.ID {
		return NodeView{}, apperr.New(domain.ErrNotTrashed, "node is not a trash root")
	}
	if s.expired(n) {
		return NodeView{}, errGone()
	}
	relocate := true
	if n.ParentID != nil {
		if p, err := s.repo.Node(ctx, *n.ParentID); err == nil && !p.Deleted() {
			relocate = false
		}
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.RestoreTrash(ctx, n.ID); err != nil {
			return err
		}
		if relocate {
			if n.Visibility == "" {
				eff := sc.access.Visibility
				if eff == "" {
					eff = domain.Private
				}
				wr := n.WorkspaceRole
				if src := sc.sourceElement(sc.access.VisibilitySource); src != nil && eff == domain.Workspace {
					wr = src.WorkspaceRole
				}
				if _, err := r.SetNodeVisibility(ctx, n.ID, eff, wr); err != nil {
					return err
				}
			}
			sibs, err := r.Siblings(ctx, n.SpaceID, nil)
			if err != nil {
				return err
			}
			rank, err := rankBetween(without(sibs, n.ID), nil, nil)
			if err != nil {
				return err
			}
			if _, err := r.Place(ctx, n, n.SpaceID, nil, rank, "/", 1); err != nil {
				return err
			}
		}
		return s.audit(ctx, r, n.WorkspaceID, &n.SpaceID, &n.ID, user, domain.AuditNodeRestored,
			map[string]any{"title": n.Title, "relocated": relocate})
	})
	if err != nil {
		return NodeView{}, err
	}
	return s.Node(ctx, user, id)
}

func (sc *scope) sourceElement(id uuid.UUID) *domain.Element {
	for i := range sc.chain {
		if sc.chain[i].ID == id {
			return &sc.chain[i]
		}
	}
	return nil
}

// PurgeNode permanently deletes a trashed subtree (owner role).
func (s *Service) PurgeNode(ctx context.Context, user, id uuid.UUID) error {
	sc, err := s.loadNode(ctx, user, id, true)
	if err != nil {
		return err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return err
	}
	n := *sc.node
	if n.TrashRootID == nil || *n.TrashRootID != n.ID {
		return apperr.New(domain.ErrNotTrashed, "node is not a trash root")
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := purgeRoot(ctx, r, n); err != nil {
			return err
		}
		return s.audit(ctx, r, n.WorkspaceID, &n.SpaceID, &n.ID, user, domain.AuditNodePurged, map[string]any{"title": n.Title})
	})
}
