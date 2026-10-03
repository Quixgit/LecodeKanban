package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Target names the element a sharing operation applies to: a space (NodeID nil) or a node.
type Target struct {
	SpaceID uuid.UUID
	NodeID  *uuid.UUID
}

func (s *Service) load(ctx context.Context, user uuid.UUID, t Target) (*scope, error) {
	if t.NodeID != nil {
		return s.loadNode(ctx, user, *t.NodeID, false)
	}
	return s.loadSpace(ctx, user, t.SpaceID)
}

// GrantView is a direct or inherited grant; Source tells where an inherited one is set.
type GrantView struct {
	domain.Grant
	Inherited   bool
	SourceID    uuid.UUID
	Source      string // "space" or "node"
	SourceTitle string
}

// VisibilitySource says which element sets the effective visibility.
type VisibilitySource struct {
	ID    uuid.UUID
	Kind  string
	Title string
}

// AccessSummary is the share dialog's data: who can reach the element and why.
type AccessSummary struct {
	Role          domain.Role // the caller's effective role
	Via           domain.Via
	Visibility    domain.Visibility // effective
	WorkspaceRole domain.Role       // what workspace visibility allows (when effective)
	Own           domain.Visibility // explicit on this element; empty = inherits
	Inherited     bool
	Source        VisibilitySource
	OwnerID       uuid.UUID
	Grants        []GrantView // only for editors and above
	CanManage     bool
}

// Access returns the effective-access summary of a space or node.
func (s *Service) Access(ctx context.Context, user uuid.UUID, t Target) (AccessSummary, error) {
	sc, err := s.load(ctx, user, t)
	if err != nil {
		return AccessSummary{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return AccessSummary{}, err
	}
	last := sc.chain[len(sc.chain)-1]
	out := AccessSummary{Role: sc.access.Role, Via: sc.access.Via, Visibility: sc.access.Visibility,
		Own: last.Visibility, Inherited: sc.access.VisibilitySource != last.ID, OwnerID: last.OwnerID,
		CanManage: sc.access.Role.Can(domain.CapManage), Grants: []GrantView{}}
	for i, el := range sc.chain {
		if el.ID == sc.access.VisibilitySource {
			out.WorkspaceRole = el.WorkspaceRole
			out.Source = VisibilitySource{ID: el.ID, Kind: sc.labels[i].Kind, Title: sc.labels[i].Title}
		}
	}
	if !sc.access.Role.Can(domain.CapEdit) {
		return out, nil
	}
	from := 0
	for i := len(sc.chain) - 1; i > 0; i-- { // inherited grants stop at a private boundary
		if sc.chain[i].Visibility != "" {
			if sc.chain[i].Visibility == domain.Private {
				from = i
			}
			break
		}
	}
	for i := from; i < len(sc.chain); i++ {
		for _, g := range sc.chain[i].Grants {
			out.Grants = append(out.Grants, GrantView{Grant: g, Inherited: i != len(sc.chain)-1,
				SourceID: sc.chain[i].ID, Source: sc.labels[i].Kind, SourceTitle: sc.labels[i].Title})
		}
	}
	return out, nil
}

// SetVisibility changes who can reach an element. An empty visibility makes a node inherit again
// (spaces always keep an explicit one). Needs the owner role on the element.
func (s *Service) SetVisibility(ctx context.Context, user uuid.UUID, t Target, v domain.Visibility, wr domain.Role) (AccessSummary, error) {
	sc, err := s.load(ctx, user, t)
	if err != nil {
		return AccessSummary{}, err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return AccessSummary{}, err
	}
	if wr == "" {
		wr = domain.RoleViewer
	}
	var fv validation.V
	if v == "" && sc.node == nil {
		fv.Add("visibility", validation.Required, nil)
	} else if v != "" {
		fv.OneOf("visibility", string(v), string(domain.Private), string(domain.Shared), string(domain.Workspace))
	}
	validWorkspaceRole(&fv, "workspaceRole", wr)
	if err := fv.Err(); err != nil {
		return AccessSummary{}, err
	}
	before := sc.access.Visibility
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if sc.node == nil {
			if _, err := r.SetSpaceVisibility(ctx, sc.space.ID, v, wr); err != nil {
				return err
			}
		} else if _, err := r.SetNodeVisibility(ctx, sc.node.ID, v, wr); err != nil {
			return err
		}
		return s.audit(ctx, r, sc.space.WorkspaceID, &sc.space.ID, sc.nodeID(), user, domain.AuditVisibilityChanged,
			map[string]any{"from": string(before), "to": string(v), "inherit": v == "", "workspaceRole": string(wr)})
	})
	if err != nil {
		return AccessSummary{}, err
	}
	return s.Access(ctx, user, t)
}

// SetGrant gives a user (or team) a role on an element, replacing an earlier grant. Needs owner.
func (s *Service) SetGrant(ctx context.Context, user uuid.UUID, t Target, kind domain.PrincipalKind, principal uuid.UUID, role domain.Role) (GrantView, error) {
	sc, err := s.load(ctx, user, t)
	if err != nil {
		return GrantView{}, err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return GrantView{}, err
	}
	var fv validation.V
	if !kind.Valid() {
		fv.Add("kind", validation.OneOf, map[string]any{"allowed": []string{"user", "team"}})
	}
	if !role.Valid() {
		fv.Add("role", validation.OneOf, map[string]any{"allowed": []string{"owner", "editor", "commenter", "viewer"}})
	}
	if err := fv.Err(); err != nil {
		return GrantView{}, err
	}
	ws := sc.space.WorkspaceID
	switch kind {
	case domain.PrincipalUser:
		if _, err := s.ws.Authorize(ctx, ws, principal, wsdomain.PermView); err != nil {
			fv.Add("principalId", validation.NotMember, nil)
		}
	case domain.PrincipalTeam:
		if ok, err := s.teams.Exists(ctx, ws, principal); err != nil {
			return GrantView{}, err
		} else if !ok {
			fv.Add("principalId", validation.NotFound, nil)
		}
	}
	if err := fv.Err(); err != nil {
		return GrantView{}, err
	}
	nodeID := sc.nodeID()
	prev, had, err := s.repo.Grant(ctx, sc.space.ID, nodeID, kind, principal)
	if err != nil {
		return GrantView{}, err
	}
	auditKind := domain.AuditPermissionGranted
	if had {
		auditKind = domain.AuditPermissionChanged
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if _, err := r.Upsert(ctx, domain.Permission{WorkspaceID: ws, SpaceID: sc.space.ID, NodeID: nodeID,
			PrincipalKind: kind, PrincipalID: principal, Role: role, CreatedBy: &user}); err != nil {
			return err
		}
		return s.audit(ctx, r, ws, &sc.space.ID, nodeID, user, auditKind, map[string]any{
			"kind": string(kind), "principalId": principal, "role": string(role), "from": string(prev.Role)})
	})
	if err != nil {
		return GrantView{}, err
	}
	last := len(sc.labels) - 1
	return GrantView{Grant: domain.Grant{Kind: kind, PrincipalID: principal, Role: role}, SourceID: sc.id(),
		Source: sc.labels[last].Kind, SourceTitle: sc.labels[last].Title}, nil
}

// RemoveGrant revokes a direct grant. Needs owner.
func (s *Service) RemoveGrant(ctx context.Context, user uuid.UUID, t Target, kind domain.PrincipalKind, principal uuid.UUID) error {
	sc, err := s.load(ctx, user, t)
	if err != nil {
		return err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return err
	}
	nodeID := sc.nodeID()
	prev, had, err := s.repo.Grant(ctx, sc.space.ID, nodeID, kind, principal)
	if err != nil {
		return err
	}
	if !had {
		return apperr.New(domain.ErrNotFound, "grant not found")
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		if _, err := r.Revoke(ctx, sc.space.ID, nodeID, kind, principal); err != nil {
			return err
		}
		return s.audit(ctx, r, sc.space.WorkspaceID, &sc.space.ID, nodeID, user, domain.AuditPermissionRevoked,
			map[string]any{"kind": string(kind), "principalId": principal, "role": string(prev.Role)})
	})
}

// Favorite stars a node for the caller; Unfavorite is idempotent.
func (s *Service) Favorite(ctx context.Context, user, node uuid.UUID) error {
	sc, err := s.loadNode(ctx, user, node, false)
	if err != nil {
		return err
	}
	if err := sc.need(domain.CapView); err != nil {
		return err
	}
	return s.repo.AddFavorite(ctx, user, node)
}

func (s *Service) Unfavorite(ctx context.Context, user, node uuid.UUID) error {
	return s.repo.RemoveFavorite(ctx, user, node)
}

// Favorites lists the caller's starred nodes they can still see.
func (s *Service) Favorites(ctx context.Context, user, ws uuid.UUID) ([]NodeView, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	nodes, err := s.repo.Favorites(ctx, user, ws)
	if err != nil {
		return nil, err
	}
	views, err := s.newIndexes().filter(ctx, sub, nodes, domain.RoleViewer)
	for i := range views {
		views[i].Favorite = true
	}
	return views, err
}

const recentLimit = 20

// Recent lists the nodes the caller opened last, skipping those they can no longer see.
func (s *Service) Recent(ctx context.Context, user, ws uuid.UUID) ([]NodeView, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	nodes, err := s.repo.Recents(ctx, user, ws, recentLimit*2)
	if err != nil {
		return nil, err
	}
	views, err := s.newIndexes().filter(ctx, sub, nodes, domain.RoleViewer)
	if len(views) > recentLimit {
		views = views[:recentLimit]
	}
	return views, err
}

// SharedWithMe lists nodes somebody else granted the caller (directly or via a team) access to.
func (s *Service) SharedWithMe(ctx context.Context, user, ws uuid.UUID) ([]NodeView, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	nodes, err := s.repo.GrantedNodes(ctx, ws, user, sub.Teams)
	if err != nil {
		return nil, err
	}
	return s.newIndexes().filter(ctx, sub, nodes, domain.RoleViewer)
}

// MyPrivate lists the caller's own nodes that only they (and invited people) can see.
func (s *Service) MyPrivate(ctx context.Context, user, ws uuid.UUID) ([]NodeView, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	nodes, err := s.repo.OwnedNodes(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	views, err := s.newIndexes().filter(ctx, sub, nodes, domain.RoleViewer)
	if err != nil {
		return nil, err
	}
	out := views[:0]
	for _, v := range views {
		if v.Access.Visibility == domain.Private {
			out = append(out, v)
		}
	}
	return out, nil
}

// AuditPage is one page of a space's audit log; Next is the cursor for the following page.
type AuditPage struct {
	Events []domain.AuditEvent
	Next   int64
}

// Audit returns a space's sharing/move/delete history to its owners, newest first.
func (s *Service) Audit(ctx context.Context, user, space uuid.UUID, before int64, limit int) (AuditPage, error) {
	sc, err := s.loadSpace(ctx, user, space)
	if err != nil {
		return AuditPage{}, err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return AuditPage{}, err
	}
	if limit <= 0 || limit > domain.MaxPage {
		limit = domain.MaxPage
	}
	events, err := s.repo.AuditLog(ctx, space, before, limit)
	if err != nil {
		return AuditPage{}, err
	}
	page := AuditPage{Events: events}
	if len(events) == limit {
		page.Next = events[len(events)-1].ID
	}
	return page, nil
}
