package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

func permStrings(in []domain.Permission) []string {
	out := make([]string, len(in))
	for i, p := range in {
		out[i] = string(p)
	}
	return out
}

func permsFrom(in []string) []domain.Permission {
	out := make([]domain.Permission, len(in))
	for i, p := range in {
		out[i] = domain.Permission(p)
	}
	return out
}

func roleDefinition(v service.RoleView) api.RoleDefinition {
	return api.RoleDefinition{Key: v.Key, Id: v.ID, Custom: v.Custom, Name: v.Name, Description: v.Description,
		Base: api.Role(v.Base), Permissions: permStrings(v.Permissions), Defaults: permStrings(v.Defaults),
		Changed: v.Changed, Locked: v.Locked, Members: v.Members}
}

func customDefinition(c domain.CustomRole) api.RoleDefinition {
	id := c.ID
	return api.RoleDefinition{Key: c.ID.String(), Id: &id, Custom: true, Name: c.Name, Description: c.Description,
		Base: api.Role(c.Base), Permissions: permStrings(c.Permissions), Defaults: []string{}, Members: c.Members}
}

func (h *Handler) roles(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	o, err := h.svc.Roles(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := api.RolesOverview{Catalog: make([]api.PermissionInfo, len(o.Catalog)), Roles: make([]api.RoleDefinition, len(o.Roles))}
	for i, c := range o.Catalog {
		out.Catalog[i] = api.PermissionInfo{Key: string(c.Key), Group: api.PermissionInfoGroup(c.Group), Fixed: c.Fixed}
	}
	for i, v := range o.Roles {
		out.Roles[i] = roleDefinition(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func decodeRoleInput(w http.ResponseWriter, r *http.Request) (service.RoleInput, error) {
	var in api.RoleInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return service.RoleInput{}, err
	}
	desc := ""
	if in.Description != nil {
		desc = *in.Description
	}
	return service.RoleInput{Name: in.Name, Description: desc, Base: domain.Role(in.Base), Permissions: permsFrom(in.Permissions)}, nil
}

func (h *Handler) createRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	in, err := decodeRoleInput(w, r)
	if err != nil {
		return err
	}
	c, err := h.svc.CreateRole(r.Context(), userID(r), ws, in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, customDefinition(c))
	return nil
}

func roleKey(r *http.Request) string { return chi.URLParam(r, "roleKey") }

func customID(r *http.Request) (uuid.UUID, error) {
	id, err := uuid.Parse(roleKey(r))
	if err != nil {
		return uuid.Nil, apperr.New(domain.ErrRoleNotFound, "role not found")
	}
	return id, nil
}

func (h *Handler) updateRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	id, err := customID(r)
	if err != nil {
		return err
	}
	in, err := decodeRoleInput(w, r)
	if err != nil {
		return err
	}
	c, err := h.svc.UpdateRole(r.Context(), userID(r), ws, id, in)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, customDefinition(c))
	return nil
}

func (h *Handler) deleteRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	id, err := customID(r)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteRole(r.Context(), userID(r), ws, id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) setRolePermissions(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.PermissionsInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.SetRolePermissions(r.Context(), userID(r), ws, domain.Role(roleKey(r)), permsFrom(in.Permissions)); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) resetRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.ResetRole(r.Context(), userID(r), ws, domain.Role(roleKey(r))); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) assignCustomRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	target, err := pathUUID(r, "userId", domain.ErrMemberNotFound)
	if err != nil {
		return err
	}
	var in struct {
		RoleID *uuid.UUID `json:"roleId"`
	}
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.AssignCustomRole(r.Context(), userID(r), ws, target, in.RoleID); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
