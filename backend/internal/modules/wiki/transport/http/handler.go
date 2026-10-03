// Package http exposes the wiki: spaces, the node tree, sharing, trash, favorites and audit.
package http

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/wiki/spaces", httpx.H(h.listSpaces))
	r.Post("/workspaces/{workspaceId}/wiki/spaces", httpx.H(h.createSpace))
	r.Get("/workspaces/{workspaceId}/wiki/trash", httpx.H(h.trash))
	r.Get("/workspaces/{workspaceId}/wiki/favorites", httpx.H(h.nodeList(h.svc.Favorites)))
	r.Get("/workspaces/{workspaceId}/wiki/recent", httpx.H(h.nodeList(h.svc.Recent)))
	r.Get("/workspaces/{workspaceId}/wiki/shared", httpx.H(h.nodeList(h.svc.SharedWithMe)))
	r.Get("/workspaces/{workspaceId}/wiki/private", httpx.H(h.nodeList(h.svc.MyPrivate)))

	r.Get("/wiki/spaces/{spaceId}", httpx.H(h.getSpace))
	r.Patch("/wiki/spaces/{spaceId}", httpx.H(h.updateSpace))
	r.Delete("/wiki/spaces/{spaceId}", httpx.H(h.deleteSpace))
	r.Get("/wiki/spaces/{spaceId}/tree", httpx.H(h.tree))
	r.Post("/wiki/spaces/{spaceId}/nodes", httpx.H(h.createNode))
	r.Get("/wiki/spaces/{spaceId}/audit", httpx.H(h.audit))
	r.Get("/wiki/spaces/{spaceId}/access", httpx.H(h.access(spaceTarget)))
	r.Put("/wiki/spaces/{spaceId}/visibility", httpx.H(h.setVisibility(spaceTarget)))
	r.Put("/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}", httpx.H(h.setGrant(spaceTarget)))
	r.Delete("/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}", httpx.H(h.removeGrant(spaceTarget)))

	r.Get("/wiki/nodes/{nodeId}", httpx.H(h.getNode))
	r.Patch("/wiki/nodes/{nodeId}", httpx.H(h.updateNode))
	r.Delete("/wiki/nodes/{nodeId}", httpx.H(h.deleteNode))
	r.Post("/wiki/nodes/{nodeId}/move", httpx.H(h.moveNode))
	r.Post("/wiki/nodes/{nodeId}/restore", httpx.H(h.restoreNode))
	r.Delete("/wiki/nodes/{nodeId}/purge", httpx.H(h.purgeNode))
	r.Get("/wiki/nodes/{nodeId}/content", httpx.H(h.getContent))
	r.Put("/wiki/nodes/{nodeId}/content", httpx.H(h.saveContent))
	r.Post("/wiki/nodes/{nodeId}/files", httpx.H(h.uploadFile))
	r.Get("/wiki/files/{fileId}/content", httpx.H(h.downloadFile))
	r.Get("/workspaces/{workspaceId}/wiki/templates", httpx.H(h.templates))
	r.Post("/workspaces/{workspaceId}/wiki/templates", httpx.H(h.createTemplate))
	r.Delete("/workspaces/{workspaceId}/wiki/templates/{templateId}", httpx.H(h.deleteTemplate))
	r.Put("/wiki/nodes/{nodeId}/favorite", httpx.H(h.favorite))
	r.Delete("/wiki/nodes/{nodeId}/favorite", httpx.H(h.unfavorite))
	r.Get("/wiki/nodes/{nodeId}/access", httpx.H(h.access(nodeTarget)))
	r.Put("/wiki/nodes/{nodeId}/visibility", httpx.H(h.setVisibility(nodeTarget)))
	r.Put("/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}", httpx.H(h.setGrant(nodeTarget)))
	r.Delete("/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}", httpx.H(h.removeGrant(nodeTarget)))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

// param parses a path UUID; a malformed id is "not found", like an unknown one.
func param(r *http.Request, name string, code apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(code, "not found")
	}
	return id, nil
}

func workspaceParam(r *http.Request) (uuid.UUID, error) {
	return param(r, "workspaceId", wsdomain.ErrNotFound)
}
func spaceParam(r *http.Request) (uuid.UUID, error) { return param(r, "spaceId", domain.ErrNotFound) }
func nodeParam(r *http.Request) (uuid.UUID, error)  { return param(r, "nodeId", domain.ErrNotFound) }

// targetFunc resolves the element a sharing route addresses.
type targetFunc func(r *http.Request) (service.Target, error)

func spaceTarget(r *http.Request) (service.Target, error) {
	id, err := spaceParam(r)
	return service.Target{SpaceID: id}, err
}

func nodeTarget(r *http.Request) (service.Target, error) {
	id, err := nodeParam(r)
	return service.Target{NodeID: &id}, err
}

// ---- presenters

func presentAccess(a domain.Access) api.WikiAccess {
	out := api.WikiAccess{Via: api.WikiAccessVia(a.Via), Visibility: api.WikiVisibility(a.Visibility),
		VisibilitySourceId: openapi_types.UUID(a.VisibilitySource)}
	if a.Role != "" {
		role := api.WikiRole(a.Role)
		out.Role = &role
	}
	return out
}

func presentSpace(v service.SpaceView) api.WikiSpace {
	s := v.Space
	return api.WikiSpace{Id: s.ID, WorkspaceId: s.WorkspaceID, OwnerId: s.OwnerID, Name: s.Name, Icon: s.Icon,
		Color: s.Color, Description: s.Description, Visibility: api.WikiVisibility(s.Visibility),
		WorkspaceRole: api.WikiWorkspaceRole(s.WorkspaceRole), MaxDepth: s.MaxDepth, Access: presentAccess(v.Access),
		CreatedAt: s.CreatedAt, UpdatedAt: s.UpdatedAt}
}

func presentNode(v service.NodeView) api.WikiNode {
	n := v.Node
	out := api.WikiNode{Id: n.ID, SpaceId: n.SpaceID, ParentId: n.ParentID, Kind: api.WikiNodeKind(n.Kind), Title: n.Title,
		Icon: n.Icon, Cover: n.Cover, Rank: n.Rank, Depth: n.Depth, OwnerId: n.OwnerID, Favorite: v.Favorite,
		Access: presentAccess(v.Access), DeletedAt: n.DeletedAt, CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt,
		Status: api.WikiStatus(n.Status), Tags: nonNil(n.Tags), LastVerifiedAt: n.LastVerifiedAt, ReviewDays: n.ReviewDays,
		ReviewDue: n.ReviewDue(time.Now()), FullWidth: n.FullWidth, ProjectIds: nonNilIDs(v.ProjectIDs)}
	if n.Visibility != "" {
		vis := api.WikiVisibility(n.Visibility)
		out.Visibility = &vis
	}
	return out
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func nonNilIDs(s []uuid.UUID) []openapi_types.UUID {
	out := make([]openapi_types.UUID, len(s))
	for i, id := range s {
		out[i] = id
	}
	return out
}

func presentNodes(vs []service.NodeView) []api.WikiNode {
	out := make([]api.WikiNode, len(vs))
	for i, v := range vs {
		out[i] = presentNode(v)
	}
	return out
}

func presentTreeNode(t service.TreeNode) api.WikiTreeNode {
	n := presentNode(t.NodeView)
	return api.WikiTreeNode{Id: n.Id, SpaceId: n.SpaceId, Kind: api.WikiTreeNodeKind(n.Kind), Title: n.Title, Icon: n.Icon,
		Cover: n.Cover, Rank: n.Rank, Depth: n.Depth, OwnerId: n.OwnerId, Favorite: n.Favorite, Access: n.Access,
		DeletedAt: n.DeletedAt, CreatedAt: n.CreatedAt, UpdatedAt: n.UpdatedAt, Visibility: n.Visibility,
		Status: n.Status, Tags: n.Tags, LastVerifiedAt: n.LastVerifiedAt, ReviewDays: n.ReviewDays,
		ReviewDue: n.ReviewDue, FullWidth: n.FullWidth, ProjectIds: n.ProjectIds,
		// A detached node hides its parent: the caller must not learn that it exists.
		ParentId: detachedParent(n.ParentId, t.Detached), Detached: t.Detached}
}

func detachedParent(p *openapi_types.UUID, detached bool) *openapi_types.UUID {
	if detached {
		return nil
	}
	return p
}

func presentGrant(g service.GrantView) api.WikiGrant {
	return api.WikiGrant{Kind: api.WikiPrincipalKind(g.Kind), PrincipalId: g.PrincipalID, Role: api.WikiRole(g.Role),
		Inherited: g.Inherited, SourceId: g.SourceID, Source: api.WikiGrantSource(g.Source), SourceTitle: g.SourceTitle}
}

func presentSummary(a service.AccessSummary) api.WikiAccessSummary {
	out := api.WikiAccessSummary{Via: api.WikiAccessSummaryVia(a.Via), Visibility: api.WikiVisibility(a.Visibility),
		WorkspaceRole: api.WikiWorkspaceRole(a.WorkspaceRole), Inherited: a.Inherited, SourceId: a.Source.ID,
		Source: api.WikiAccessSummarySource(a.Source.Kind), SourceTitle: a.Source.Title, OwnerId: a.OwnerID,
		CanManage: a.CanManage, Grants: make([]api.WikiGrant, len(a.Grants))}
	if a.Role != "" {
		role := api.WikiRole(a.Role)
		out.Role = &role
	}
	if a.Own != "" {
		own := api.WikiVisibility(a.Own)
		out.Own = &own
	}
	for i, g := range a.Grants {
		out.Grants[i] = presentGrant(g)
	}
	return out
}

// ---- spaces

func (h *Handler) listSpaces(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	spaces, err := h.svc.Spaces(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.WikiSpace, len(spaces))
	for i, s := range spaces {
		out[i] = presentSpace(s)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createSpace(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	var in api.WikiSpaceInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	si := service.SpaceInput{Name: in.Name}
	if in.Icon != nil {
		si.Icon = *in.Icon
	}
	if in.Color != nil {
		si.Color = *in.Color
	}
	if in.Description != nil {
		si.Description = *in.Description
	}
	if in.Visibility != nil {
		si.Visibility = domain.Visibility(*in.Visibility)
	}
	if in.WorkspaceRole != nil {
		si.WorkspaceRole = domain.Role(*in.WorkspaceRole)
	}
	if in.MaxDepth != nil {
		si.MaxDepth = *in.MaxDepth
	}
	v, err := h.svc.CreateSpace(r.Context(), userID(r), ws, si)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, presentSpace(v))
	return nil
}

func (h *Handler) getSpace(w http.ResponseWriter, r *http.Request) error {
	id, err := spaceParam(r)
	if err != nil {
		return err
	}
	v, err := h.svc.Space(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentSpace(v))
	return nil
}

func (h *Handler) updateSpace(w http.ResponseWriter, r *http.Request) error {
	id, err := spaceParam(r)
	if err != nil {
		return err
	}
	var in api.WikiSpacePatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.UpdateSpace(r.Context(), userID(r), id, service.SpacePatch{Name: in.Name, Icon: in.Icon,
		Color: in.Color, Description: in.Description, MaxDepth: in.MaxDepth})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentSpace(v))
	return nil
}

func (h *Handler) deleteSpace(w http.ResponseWriter, r *http.Request) error {
	id, err := spaceParam(r)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteSpace(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) tree(w http.ResponseWriter, r *http.Request) error {
	id, err := spaceParam(r)
	if err != nil {
		return err
	}
	t, err := h.svc.Tree(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := api.WikiTree{Space: presentSpace(service.SpaceView{Space: t.Space, Access: t.Access}),
		Nodes: make([]api.WikiTreeNode, len(t.Nodes))}
	for i, n := range t.Nodes {
		out.Nodes[i] = presentTreeNode(n)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// ---- nodes

func (h *Handler) createNode(w http.ResponseWriter, r *http.Request) error {
	space, err := spaceParam(r)
	if err != nil {
		return err
	}
	var in api.WikiNodeInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	ni := service.NodeInput{Kind: domain.Kind(in.Kind), Title: in.Title, ParentID: in.ParentId, AfterID: in.AfterId}
	if in.Icon != nil {
		ni.Icon = *in.Icon
	}
	if in.TemplateId != nil {
		ni.TemplateID = *in.TemplateId
	}
	if in.Lang != nil {
		ni.Lang = string(*in.Lang)
	}
	v, err := h.svc.CreateNode(r.Context(), userID(r), space, ni)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, presentNode(v))
	return nil
}

func (h *Handler) getNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	v, err := h.svc.Node(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentNode(v))
	return nil
}

func (h *Handler) updateNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	var in api.WikiNodePatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	patch := service.NodePatch{Title: in.Title, Icon: in.Icon, Cover: in.Cover, ReviewDays: in.ReviewDays,
		FullWidth: in.FullWidth, Verify: in.Verify != nil && *in.Verify, Tags: in.Tags}
	if in.Status != nil {
		st := domain.Status(*in.Status)
		patch.Status = &st
	}
	if in.ProjectIds != nil {
		ids := make([]uuid.UUID, len(*in.ProjectIds))
		for i, id := range *in.ProjectIds {
			ids[i] = id
		}
		patch.ProjectIDs = &ids
	}
	v, err := h.svc.UpdateNode(r.Context(), userID(r), id, patch)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentNode(v))
	return nil
}

func (h *Handler) deleteNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteNode(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) moveNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	var in api.WikiMoveInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.MoveNode(r.Context(), userID(r), id, service.MoveInput{SpaceID: in.SpaceId, ParentID: in.ParentId,
		BeforeID: in.BeforeId, AfterID: in.AfterId, ConfirmWiden: in.ConfirmWiden != nil && *in.ConfirmWiden})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentNode(v))
	return nil
}

func (h *Handler) restoreNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	v, err := h.svc.RestoreNode(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, presentNode(v))
	return nil
}

func (h *Handler) purgeNode(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	if err := h.svc.PurgeNode(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) favorite(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	if err := h.svc.Favorite(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) unfavorite(w http.ResponseWriter, r *http.Request) error {
	id, err := nodeParam(r)
	if err != nil {
		return err
	}
	if err := h.svc.Unfavorite(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

// ---- lists

func (h *Handler) nodeList(fn func(ctx context.Context, user, ws uuid.UUID) ([]service.NodeView, error)) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		ws, err := workspaceParam(r)
		if err != nil {
			return err
		}
		vs, err := fn(r.Context(), userID(r), ws)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, presentNodes(vs))
		return nil
	}
}

func (h *Handler) trash(w http.ResponseWriter, r *http.Request) error {
	ws, err := workspaceParam(r)
	if err != nil {
		return err
	}
	items, err := h.svc.Trash(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.WikiTrashItem, len(items))
	for i, it := range items {
		n := presentNode(it.NodeView)
		expires := it.Node.CreatedAt
		if it.Node.DeletedAt != nil {
			expires = it.Node.DeletedAt.Add(domain.TrashRetention)
		}
		out[i] = api.WikiTrashItem{Node: n, ExpiresAt: expires}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) audit(w http.ResponseWriter, r *http.Request) error {
	space, err := spaceParam(r)
	if err != nil {
		return err
	}
	var before int64
	if v := r.URL.Query().Get("before"); v != "" {
		if before, err = strconv.ParseInt(v, 10, 64); err != nil || before < 0 {
			return apperr.New(apperr.BadRequest, "invalid cursor")
		}
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	page, err := h.svc.Audit(r.Context(), userID(r), space, before, limit)
	if err != nil {
		return err
	}
	out := api.WikiAuditPage{Events: make([]api.WikiAuditEvent, len(page.Events))}
	for i, e := range page.Events {
		out.Events[i] = api.WikiAuditEvent{Id: e.ID, Kind: e.Kind, ActorId: e.ActorID, NodeId: e.NodeID, Data: e.Data, At: e.At}
	}
	if page.Next != 0 {
		out.Next = &page.Next
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// ---- sharing (spaces and nodes share these handlers)

func (h *Handler) access(target targetFunc) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		t, err := target(r)
		if err != nil {
			return err
		}
		s, err := h.svc.Access(r.Context(), userID(r), t)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, presentSummary(s))
		return nil
	}
}

func (h *Handler) setVisibility(target targetFunc) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		t, err := target(r)
		if err != nil {
			return err
		}
		var in api.WikiVisibilityInput
		if err := httpx.DecodeJSON(w, r, &in); err != nil {
			return err
		}
		var vis domain.Visibility
		if in.Visibility != nil {
			vis = domain.Visibility(*in.Visibility)
		}
		var wr domain.Role
		if in.WorkspaceRole != nil {
			wr = domain.Role(*in.WorkspaceRole)
		}
		s, err := h.svc.SetVisibility(r.Context(), userID(r), t, vis, wr)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, presentSummary(s))
		return nil
	}
}

func principal(r *http.Request) (domain.PrincipalKind, uuid.UUID, error) {
	id, err := param(r, "principalId", domain.ErrNotFound)
	if err != nil {
		return "", uuid.Nil, err
	}
	kind := domain.PrincipalKind(chi.URLParam(r, "kind"))
	if !kind.Valid() {
		return "", uuid.Nil, apperr.New(domain.ErrNotFound, "not found")
	}
	return kind, id, nil
}

func (h *Handler) setGrant(target targetFunc) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		t, err := target(r)
		if err != nil {
			return err
		}
		kind, id, err := principal(r)
		if err != nil {
			return err
		}
		var in api.WikiGrantInput
		if err := httpx.DecodeJSON(w, r, &in); err != nil {
			return err
		}
		g, err := h.svc.SetGrant(r.Context(), userID(r), t, kind, id, domain.Role(in.Role))
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, presentGrant(g))
		return nil
	}
}

func (h *Handler) removeGrant(target targetFunc) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		t, err := target(r)
		if err != nil {
			return err
		}
		kind, id, err := principal(r)
		if err != nil {
			return err
		}
		if err := h.svc.RemoveGrant(r.Context(), userID(r), t, kind, id); err != nil {
			return err
		}
		httpx.NoContent(w)
		return nil
	}
}
