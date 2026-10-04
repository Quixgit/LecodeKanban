package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

func toPerms(in []string) []domain.Permission {
	out := make([]domain.Permission, len(in))
	for i, p := range in {
		out[i] = domain.Permission(p)
	}
	return out
}

func fromPerms(in []domain.Permission) []string {
	out := make([]string, len(in))
	for i, p := range in {
		out[i] = string(p)
	}
	return out
}

// Access returns what a person may do in a workspace; the zero Access (no role) means they are not a member.
func (r *Repo) Access(ctx context.Context, ws, user uuid.UUID) (domain.Access, error) {
	row, err := r.q.MemberAccess(ctx, store.MemberAccessParams{WorkspaceID: ws, UserID: user})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Access{}, nil
	}
	if err != nil {
		return domain.Access{}, err
	}
	role := domain.Role(row.Role)
	var perms []domain.Permission
	var custom *uuid.UUID
	name := ""
	switch {
	case row.CustomRoleID.Valid && row.CustomPerms != nil:
		id := row.CustomRoleID.UUID
		custom = &id
		perms = toPerms(row.CustomPerms)
		if row.CustomName != nil {
			name = *row.CustomName
		}
	case row.OverridePerms != nil:
		perms = toPerms(row.OverridePerms)
	default:
		perms = domain.RoleDefaults(role)
	}
	return domain.NewAccess(role, perms, custom, name), nil
}

// RoleOverrides returns the workspace's changed built-in roles.
func (r *Repo) RoleOverrides(ctx context.Context, ws uuid.UUID) (map[domain.Role][]domain.Permission, error) {
	rows, err := r.q.ListRoleOverrides(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := map[domain.Role][]domain.Permission{}
	for _, o := range rows {
		out[domain.Role(o.Role)] = toPerms(o.Permissions)
	}
	return out, nil
}

func (r *Repo) PutRoleOverride(ctx context.Context, ws uuid.UUID, role domain.Role, perms []domain.Permission) error {
	return r.q.PutRoleOverride(ctx, store.PutRoleOverrideParams{WorkspaceID: ws, Role: string(role), Permissions: fromPerms(perms)})
}

func (r *Repo) DeleteRoleOverride(ctx context.Context, ws uuid.UUID, role domain.Role) error {
	return r.q.DeleteRoleOverride(ctx, store.DeleteRoleOverrideParams{WorkspaceID: ws, Role: string(role)})
}

func toCustom(id, ws uuid.UUID, name, desc, base string, perms []string, members int32) domain.CustomRole {
	return domain.CustomRole{ID: id, WorkspaceID: ws, Name: name, Description: desc, Base: domain.Role(base),
		Permissions: toPerms(perms), Members: int(members)}
}

func (r *Repo) CustomRoles(ctx context.Context, ws uuid.UUID) ([]domain.CustomRole, error) {
	rows, err := r.q.ListCustomRoles(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.CustomRole, len(rows))
	for i, c := range rows {
		out[i] = toCustom(c.ID, c.WorkspaceID, c.Name, c.Description, c.Base, c.Permissions, c.Members)
	}
	return out, nil
}

func (r *Repo) CustomRole(ctx context.Context, id uuid.UUID) (domain.CustomRole, error) {
	c, err := r.q.GetCustomRole(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.CustomRole{}, apperr.New(domain.ErrRoleNotFound, "role not found")
	}
	if err != nil {
		return domain.CustomRole{}, err
	}
	return toCustom(c.ID, c.WorkspaceID, c.Name, c.Description, c.Base, c.Permissions, 0), nil
}

func nameTaken(err error) error {
	if db.IsUniqueViolation(err, "workspace_roles_name_idx") {
		return apperr.New(domain.ErrRoleNameTaken, "a role with this name already exists")
	}
	return err
}

func (r *Repo) CreateCustomRole(ctx context.Context, ws uuid.UUID, name, desc string, base domain.Role, perms []domain.Permission) (domain.CustomRole, error) {
	c, err := r.q.CreateCustomRole(ctx, store.CreateCustomRoleParams{WorkspaceID: ws, Name: name, Description: desc, Base: string(base), Permissions: fromPerms(perms)})
	if err != nil {
		return domain.CustomRole{}, nameTaken(err)
	}
	return toCustom(c.ID, c.WorkspaceID, c.Name, c.Description, c.Base, c.Permissions, 0), nil
}

func (r *Repo) UpdateCustomRole(ctx context.Context, id uuid.UUID, name, desc string, base domain.Role, perms []domain.Permission) (domain.CustomRole, error) {
	c, err := r.q.UpdateCustomRole(ctx, store.UpdateCustomRoleParams{ID: id, Name: name, Description: desc, Base: string(base), Permissions: fromPerms(perms)})
	if err != nil {
		return domain.CustomRole{}, nameTaken(err)
	}
	return toCustom(c.ID, c.WorkspaceID, c.Name, c.Description, c.Base, c.Permissions, 0), nil
}

func (r *Repo) DeleteCustomRole(ctx context.Context, id uuid.UUID) error {
	return r.q.DeleteCustomRole(ctx, id)
}

// SetMemberRole sets a member's built-in role and, optionally, a custom role on top of it.
func (r *Repo) SetMemberRole(ctx context.Context, ws, user uuid.UUID, role domain.Role, custom *uuid.UUID) error {
	return r.q.SetMemberCustomRole(ctx, store.SetMemberCustomRoleParams{WorkspaceID: ws, UserID: user, Role: string(role),
		CustomRoleID: uuid.NullUUID{UUID: derefUUID(custom), Valid: custom != nil}})
}

func derefUUID(u *uuid.UUID) uuid.UUID {
	if u == nil {
		return uuid.Nil
	}
	return *u
}
