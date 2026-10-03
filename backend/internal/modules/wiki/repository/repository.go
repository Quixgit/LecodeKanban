// Package repository persists wiki spaces, nodes, grants, favorites and the audit log.
package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error { return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)}) })
}

func nullID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func ptrID(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func toSpace(s store.WikiSpace) domain.Space {
	return domain.Space{ID: s.ID, WorkspaceID: s.WorkspaceID, OwnerID: s.OwnerID, Name: s.Name, Icon: s.Icon,
		Color: s.Color, Description: s.Description, Visibility: domain.Visibility(s.Visibility),
		WorkspaceRole: domain.Role(s.WorkspaceRole), MaxDepth: int(s.MaxDepth), CreatedAt: s.CreatedAt,
		UpdatedAt: s.UpdatedAt}
}

func toNode(n store.WikiNode) domain.Node {
	out := domain.Node{ID: n.ID, WorkspaceID: n.WorkspaceID, SpaceID: n.SpaceID, ParentID: ptrID(n.ParentID),
		Kind: domain.Kind(n.Kind), Title: n.Title, Icon: n.Icon, Cover: n.Cover, Rank: n.Rank, Depth: int(n.Depth),
		Path: n.Path, WorkspaceRole: domain.Role(n.WorkspaceRole), OwnerID: n.OwnerID, CreatedBy: n.CreatedBy,
		CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt, DeletedAt: n.DeletedAt, DeletedBy: ptrID(n.DeletedBy),
		TrashRootID: ptrID(n.TrashRootID)}
	if n.Visibility != nil {
		out.Visibility = domain.Visibility(*n.Visibility)
	}
	return out
}

func toNodes(rows []store.WikiNode) []domain.Node {
	out := make([]domain.Node, len(rows))
	for i, n := range rows {
		out[i] = toNode(n)
	}
	return out
}

func toPermission(p store.WikiPermission) domain.Permission {
	return domain.Permission{ID: p.ID, WorkspaceID: p.WorkspaceID, SpaceID: p.SpaceID, NodeID: ptrID(p.NodeID),
		PrincipalKind: domain.PrincipalKind(p.PrincipalKind), PrincipalID: p.PrincipalID, Role: domain.Role(p.Role),
		CreatedBy: ptrID(p.CreatedBy), CreatedAt: p.CreatedAt}
}

func toPermissions(rows []store.WikiPermission) []domain.Permission {
	out := make([]domain.Permission, len(rows))
	for i, p := range rows {
		out[i] = toPermission(p)
	}
	return out
}

func notFound(err error) error {
	if db.IsNoRows(err) {
		return apperr.Wrap(domain.ErrNotFound, "wiki element not found", err)
	}
	return err
}

// ---- spaces

type NewSpace struct {
	WorkspaceID, OwnerID uuid.UUID
	Name, Icon, Color    string
	Description          string
	Visibility           domain.Visibility
	WorkspaceRole        domain.Role
	MaxDepth             int
}

func (r *Repo) CreateSpace(ctx context.Context, in NewSpace) (domain.Space, error) {
	s, err := r.q.CreateSpace(ctx, store.CreateSpaceParams{WorkspaceID: in.WorkspaceID, OwnerID: in.OwnerID,
		Name: in.Name, Icon: in.Icon, Color: in.Color, Description: in.Description,
		Visibility: string(in.Visibility), WorkspaceRole: string(in.WorkspaceRole), MaxDepth: int16(in.MaxDepth)}) //nolint:gosec // validated 2..32
	return toSpace(s), err
}

func (r *Repo) Space(ctx context.Context, id uuid.UUID) (domain.Space, error) {
	s, err := r.q.GetSpace(ctx, id)
	if err != nil {
		return domain.Space{}, notFound(err)
	}
	return toSpace(s), nil
}

func (r *Repo) Spaces(ctx context.Context, ws uuid.UUID) ([]domain.Space, error) {
	rows, err := r.q.ListSpaces(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Space, len(rows))
	for i, s := range rows {
		out[i] = toSpace(s)
	}
	return out, nil
}

func (r *Repo) UpdateSpace(ctx context.Context, s domain.Space) (domain.Space, error) {
	row, err := r.q.UpdateSpace(ctx, store.UpdateSpaceParams{ID: s.ID, Name: s.Name, Icon: s.Icon, Color: s.Color,
		Description: s.Description, MaxDepth: int16(s.MaxDepth)}) //nolint:gosec // validated 2..32
	return toSpace(row), notFound(err)
}

func (r *Repo) SetSpaceVisibility(ctx context.Context, id uuid.UUID, v domain.Visibility, wr domain.Role) (domain.Space, error) {
	row, err := r.q.SetSpaceVisibility(ctx, store.SetSpaceVisibilityParams{ID: id, Visibility: string(v), WorkspaceRole: string(wr)})
	return toSpace(row), notFound(err)
}

func (r *Repo) DeleteSpace(ctx context.Context, id uuid.UUID) error { return r.q.DeleteSpace(ctx, id) }

// ---- nodes

type NewNode struct {
	ID, WorkspaceID, SpaceID uuid.UUID
	ParentID                 *uuid.UUID
	Kind                     domain.Kind
	Title, Icon, Rank, Path  string
	Depth                    int
	OwnerID                  uuid.UUID
}

func (r *Repo) CreateNode(ctx context.Context, in NewNode) (domain.Node, error) {
	n, err := r.q.CreateNode(ctx, store.CreateNodeParams{ID: in.ID, WorkspaceID: in.WorkspaceID, SpaceID: in.SpaceID,
		ParentID: nullID(in.ParentID), Kind: string(in.Kind), Title: in.Title, Icon: in.Icon, Rank: in.Rank,
		Depth: int16(in.Depth), Path: in.Path, OwnerID: in.OwnerID}) //nolint:gosec // bounded by max_depth
	return toNode(n), err
}

func (r *Repo) Node(ctx context.Context, id uuid.UUID) (domain.Node, error) {
	n, err := r.q.GetNode(ctx, id)
	if err != nil {
		return domain.Node{}, notFound(err)
	}
	return toNode(n), nil
}

func (r *Repo) Nodes(ctx context.Context, ids []uuid.UUID) ([]domain.Node, error) {
	rows, err := r.q.GetNodes(ctx, ids)
	return toNodes(rows), err
}

// SpaceNodes returns every node of a space, trashed ones included (they are chain links).
func (r *Repo) SpaceNodes(ctx context.Context, space uuid.UUID) ([]domain.Node, error) {
	rows, err := r.q.ListSpaceNodes(ctx, space)
	return toNodes(rows), err
}

// Siblings lists the live children of parent (nil = space root) in order.
func (r *Repo) Siblings(ctx context.Context, space uuid.UUID, parent *uuid.UUID) ([]domain.Node, error) {
	rows, err := r.q.ListSiblings(ctx, store.ListSiblingsParams{SpaceID: space, ParentID: nullID(parent)})
	return toNodes(rows), err
}

func (r *Repo) UpdateNodeMeta(ctx context.Context, id uuid.UUID, title, icon, cover string) (domain.Node, error) {
	n, err := r.q.UpdateNodeMeta(ctx, store.UpdateNodeMetaParams{ID: id, Title: title, Icon: icon, Cover: cover})
	return toNode(n), notFound(err)
}

// SetNodeVisibility stores an explicit visibility, or inheritance when v is empty.
func (r *Repo) SetNodeVisibility(ctx context.Context, id uuid.UUID, v domain.Visibility, wr domain.Role) (domain.Node, error) {
	var vis *string
	if v != "" {
		s := string(v)
		vis = &s
	}
	n, err := r.q.SetNodeVisibility(ctx, store.SetNodeVisibilityParams{ID: id, Visibility: vis, WorkspaceRole: string(wr)})
	return toNode(n), notFound(err)
}

// Place moves one node and rebases its whole subtree (paths, depth, space) and their grants.
func (r *Repo) Place(ctx context.Context, n domain.Node, space uuid.UUID, parent *uuid.UUID, rank, parentPath string, depth int) (domain.Node, error) {
	newPath := parentPath + n.ID.String() + "/"
	row, err := r.q.PlaceNode(ctx, store.PlaceNodeParams{ID: n.ID, SpaceID: space, ParentID: nullID(parent), Rank: rank,
		Depth: int16(depth), Path: newPath}) //nolint:gosec // bounded by max_depth
	if err != nil {
		return domain.Node{}, notFound(err)
	}
	if err := r.q.RebaseDescendants(ctx, store.RebaseDescendantsParams{NewPrefix: newPath, OldPrefix: n.Path,
		Delta: int16(depth - n.Depth), SpaceID: space, ID: n.ID}); err != nil { //nolint:gosec // bounded by max_depth
		return domain.Node{}, err
	}
	if space != n.SpaceID {
		if err := r.q.MoveGrantsToSpace(ctx, store.MoveGrantsToSpaceParams{SpaceID: space, Prefix: newPath}); err != nil {
			return domain.Node{}, err
		}
	}
	return toNode(row), nil
}

func (r *Repo) SubtreeMaxDepth(ctx context.Context, path string) (int, error) {
	d, err := r.q.SubtreeMaxDepth(ctx, path)
	return int(d), err
}

func (r *Repo) Trash(ctx context.Context, n domain.Node, by uuid.UUID) error {
	return r.q.TrashSubtree(ctx, store.TrashSubtreeParams{DeletedBy: uuid.NullUUID{UUID: by, Valid: true},
		TrashRootID: uuid.NullUUID{UUID: n.ID, Valid: true}, Prefix: n.Path})
}

func (r *Repo) RestoreTrash(ctx context.Context, root uuid.UUID) error {
	return r.q.RestoreTrashRoot(ctx, uuid.NullUUID{UUID: root, Valid: true})
}

func (r *Repo) TrashRoots(ctx context.Context, ws uuid.UUID, since time.Time) ([]domain.Node, error) {
	rows, err := r.q.ListTrashRoots(ctx, store.ListTrashRootsParams{WorkspaceID: ws, DeletedAt: &since})
	return toNodes(rows), err
}

func (r *Repo) PurgeTrashRoot(ctx context.Context, root uuid.UUID) error {
	return r.q.PurgeTrashRoot(ctx, uuid.NullUUID{UUID: root, Valid: true})
}

// ExpiredTrashRoots lists trash roots deleted before the cutoff, oldest first.
func (r *Repo) ExpiredTrashRoots(ctx context.Context, cutoff time.Time) ([]domain.Node, error) {
	rows, err := r.q.ListExpiredTrashRoots(ctx, &cutoff)
	return toNodes(rows), err
}

func (r *Repo) GrantedNodes(ctx context.Context, ws, user uuid.UUID, teams []uuid.UUID) ([]domain.Node, error) {
	if teams == nil {
		teams = []uuid.UUID{}
	}
	rows, err := r.q.ListGrantedNodes(ctx, store.ListGrantedNodesParams{WorkspaceID: ws, OwnerID: user, TeamIds: teams})
	return toNodes(rows), err
}

func (r *Repo) OwnedNodes(ctx context.Context, ws, user uuid.UUID) ([]domain.Node, error) {
	rows, err := r.q.ListOwnedNodes(ctx, store.ListOwnedNodesParams{WorkspaceID: ws, OwnerID: user})
	return toNodes(rows), err
}

// ---- grants

func (r *Repo) Upsert(ctx context.Context, p domain.Permission) (domain.Permission, error) {
	row, err := r.q.UpsertPermission(ctx, store.UpsertPermissionParams{WorkspaceID: p.WorkspaceID, SpaceID: p.SpaceID,
		NodeID: nullID(p.NodeID), PrincipalKind: string(p.PrincipalKind), PrincipalID: p.PrincipalID,
		Role: string(p.Role), CreatedBy: nullID(p.CreatedBy)})
	return toPermission(row), err
}

// Grant returns the direct grant of a principal on an element (ok=false when there is none).
func (r *Repo) Grant(ctx context.Context, space uuid.UUID, node *uuid.UUID, kind domain.PrincipalKind, principal uuid.UUID) (domain.Permission, bool, error) {
	row, err := r.q.GetPermission(ctx, store.GetPermissionParams{SpaceID: space, NodeID: nullID(node),
		PrincipalKind: string(kind), PrincipalID: principal})
	if db.IsNoRows(err) {
		return domain.Permission{}, false, nil
	}
	return toPermission(row), err == nil, err
}

func (r *Repo) Revoke(ctx context.Context, space uuid.UUID, node *uuid.UUID, kind domain.PrincipalKind, principal uuid.UUID) (bool, error) {
	n, err := r.q.DeletePermission(ctx, store.DeletePermissionParams{SpaceID: space, NodeID: nullID(node),
		PrincipalKind: string(kind), PrincipalID: principal})
	return n > 0, err
}

func (r *Repo) SpacePermissions(ctx context.Context, space uuid.UUID) ([]domain.Permission, error) {
	rows, err := r.q.ListSpacePermissions(ctx, space)
	return toPermissions(rows), err
}

func (r *Repo) ChainPermissions(ctx context.Context, space uuid.UUID, nodes []uuid.UUID) ([]domain.Permission, error) {
	rows, err := r.q.ListChainPermissions(ctx, store.ListChainPermissionsParams{SpaceID: space, NodeIds: nodes})
	return toPermissions(rows), err
}

// ---- favorites and recents

func (r *Repo) AddFavorite(ctx context.Context, user, node uuid.UUID) error {
	return r.q.AddFavorite(ctx, store.AddFavoriteParams{UserID: user, NodeID: node})
}

func (r *Repo) RemoveFavorite(ctx context.Context, user, node uuid.UUID) error {
	return r.q.RemoveFavorite(ctx, store.RemoveFavoriteParams{UserID: user, NodeID: node})
}

func (r *Repo) Favorites(ctx context.Context, user, ws uuid.UUID) ([]domain.Node, error) {
	rows, err := r.q.ListFavoriteNodes(ctx, store.ListFavoriteNodesParams{UserID: user, WorkspaceID: ws})
	return toNodes(rows), err
}

func (r *Repo) FavoriteIDs(ctx context.Context, user, space uuid.UUID) (map[uuid.UUID]bool, error) {
	ids, err := r.q.FavoriteIDs(ctx, store.FavoriteIDsParams{UserID: user, SpaceID: space})
	out := make(map[uuid.UUID]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out, err
}

func (r *Repo) TouchRecent(ctx context.Context, user, node uuid.UUID) error {
	return r.q.TouchRecent(ctx, store.TouchRecentParams{UserID: user, NodeID: node})
}

func (r *Repo) Recents(ctx context.Context, user, ws uuid.UUID, limit int) ([]domain.Node, error) {
	rows, err := r.q.ListRecentNodes(ctx, store.ListRecentNodesParams{UserID: user, WorkspaceID: ws, Limit: int32(limit)}) //nolint:gosec // small page size
	return toNodes(rows), err
}

// ---- audit

func (r *Repo) Audit(ctx context.Context, e domain.AuditEvent) error {
	data, err := json.Marshal(e.Data)
	if err != nil {
		return err
	}
	return r.q.InsertAudit(ctx, store.InsertAuditParams{WorkspaceID: e.WorkspaceID, SpaceID: nullID(e.SpaceID),
		NodeID: nullID(e.NodeID), ActorID: nullID(e.ActorID), Kind: e.Kind, Data: data})
}

// AuditLog returns a space's events newest first; before=0 starts at the newest.
func (r *Repo) AuditLog(ctx context.Context, space uuid.UUID, before int64, limit int) ([]domain.AuditEvent, error) {
	rows, err := r.q.ListAudit(ctx, store.ListAuditParams{SpaceID: uuid.NullUUID{UUID: space, Valid: true},
		Column2: before, Limit: int32(limit)}) //nolint:gosec // capped by domain.MaxPage
	if err != nil {
		return nil, err
	}
	out := make([]domain.AuditEvent, len(rows))
	for i, a := range rows {
		ev := domain.AuditEvent{ID: a.ID, WorkspaceID: a.WorkspaceID, SpaceID: ptrID(a.SpaceID), NodeID: ptrID(a.NodeID),
			ActorID: ptrID(a.ActorID), Kind: a.Kind, At: a.At, Data: map[string]any{}}
		_ = json.Unmarshal(a.Data, &ev.Data)
		out[i] = ev
	}
	return out, nil
}
