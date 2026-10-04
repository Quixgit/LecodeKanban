package service

import (
	"context"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Limits keep the roles screen readable.
const (
	MaxCustomRoles = 20
	MaxRoleName    = 40
	MaxRoleDesc    = 200
)

// RoleView is a role as the roles screen shows it.
type RoleView struct {
	// Key is the built-in role name, or the id of a custom role.
	Key         string
	ID          *uuid.UUID
	Custom      bool
	Name        string
	Description string
	Base        domain.Role
	Permissions []domain.Permission
	Defaults    []domain.Permission // for built-in roles: what they start with
	Changed     bool                // built-in role whose permissions differ from the defaults
	Locked      bool                // the owner: always everything
	Members     int
}

// RolesOverview is the permission catalog and every role of the workspace.
type RolesOverview struct {
	Catalog []domain.PermInfo
	Roles   []RoleView
}

// Roles returns the roles of a workspace, with the effective permissions of each.
func (s *Service) Roles(ctx context.Context, user, ws uuid.UUID) (RolesOverview, error) {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermView); err != nil {
		return RolesOverview{}, err
	}
	overrides, err := s.repo.RoleOverrides(ctx, ws)
	if err != nil {
		return RolesOverview{}, err
	}
	custom, err := s.repo.CustomRoles(ctx, ws)
	if err != nil {
		return RolesOverview{}, err
	}
	members, err := s.repo.Members(ctx, ws)
	if err != nil {
		return RolesOverview{}, err
	}
	count := map[domain.Role]int{}
	for _, m := range members {
		if m.CustomRole == nil {
			count[m.Role]++
		}
	}
	out := RolesOverview{Catalog: domain.Catalog}
	for _, r := range []domain.Role{domain.RoleOwner, domain.RoleAdmin, domain.RoleMember, domain.RoleViewer} {
		def := domain.RoleDefaults(r)
		perms := def
		changed := false
		if o, ok := overrides[r]; ok && r != domain.RoleOwner {
			perms, changed = o, true
		}
		out.Roles = append(out.Roles, RoleView{Key: string(r), Name: string(r), Base: r, Permissions: perms, Defaults: def,
			Changed: changed, Locked: r == domain.RoleOwner, Members: count[r]})
	}
	for _, c := range custom {
		id := c.ID
		out.Roles = append(out.Roles, RoleView{Key: c.ID.String(), ID: &id, Custom: true, Name: c.Name, Description: c.Description,
			Base: c.Base, Permissions: c.Permissions, Members: c.Members})
	}
	return out, nil
}

// canGrant checks the caller holds every permission they hand out (the owner may hand out all).
func canGrant(acc domain.Access, perms []domain.Permission) error {
	if acc.Role == domain.RoleOwner {
		return nil
	}
	for _, p := range perms {
		if !acc.Can(p) {
			return apperr.New(domain.ErrInsufficientRole, "you cannot give permissions you do not have")
		}
	}
	return nil
}

func added(before, after []domain.Permission) (add, rm []string) {
	for _, p := range after {
		if !slices.Contains(before, p) {
			add = append(add, string(p))
		}
	}
	for _, p := range before {
		if !slices.Contains(after, p) {
			rm = append(rm, string(p))
		}
	}
	return add, rm
}

func sameSet(a, b []domain.Permission) bool {
	add, rm := added(a, b)
	return len(add) == 0 && len(rm) == 0
}

// SetRolePermissions changes what a built-in role (admin, member or viewer) may do in this workspace.
func (s *Service) SetRolePermissions(ctx context.Context, actor, ws uuid.UUID, role domain.Role, perms []domain.Permission) error {
	if role != domain.RoleAdmin && role != domain.RoleMember && role != domain.RoleViewer {
		return apperr.New(domain.ErrRoleLocked, "this role cannot be changed")
	}
	acc, err := s.authorize(ctx, s.repo, ws, actor, domain.PermRoles)
	if err != nil {
		return err
	}
	kept, dropped := domain.Clean(perms)
	if len(dropped) > 0 {
		var v validation.V
		v.Add("permissions", validation.OneOf, nil)
		return v.Err()
	}
	return s.repo.InTx(ctx, func(tx *repository.Repo) error {
		overrides, err := tx.RoleOverrides(ctx, ws)
		if err != nil {
			return err
		}
		before := domain.RoleDefaults(role)
		if o, ok := overrides[role]; ok {
			before = o
		}
		add, rm := added(before, kept)
		if len(add)+len(rm) == 0 {
			return nil
		}
		if err := canGrant(acc, toPerms(add)); err != nil {
			return err
		}
		if sameSet(kept, domain.RoleDefaults(role)) {
			err = tx.DeleteRoleOverride(ctx, ws, role)
		} else {
			err = tx.PutRoleOverride(ctx, ws, role, kept)
		}
		if err != nil {
			return err
		}
		return tx.AddAudit(ctx, ws, actor, "role.permissions_changed", map[string]any{"role": string(role), "added": add, "removed": rm})
	})
}

func toPerms(in []string) []domain.Permission {
	out := make([]domain.Permission, len(in))
	for i, p := range in {
		out[i] = domain.Permission(p)
	}
	return out
}

// ResetRole puts a built-in role back to its defaults.
func (s *Service) ResetRole(ctx context.Context, actor, ws uuid.UUID, role domain.Role) error {
	return s.SetRolePermissions(ctx, actor, ws, role, domain.RoleDefaults(role))
}

// RoleInput is a custom role to create or change.
type RoleInput struct {
	Name        string
	Description string
	Base        domain.Role
	Permissions []domain.Permission
}

func (s *Service) checkRole(ctx context.Context, acc domain.Access, in *RoleInput) error {
	var v validation.V
	in.Name = strings.TrimSpace(in.Name)
	in.Description = strings.TrimSpace(in.Description)
	if v.Required("name", in.Name) {
		v.Length("name", in.Name, 1, MaxRoleName)
	}
	if utf8.RuneCountInString(in.Description) > MaxRoleDesc {
		v.Add("description", validation.MaxLength, map[string]any{"max": MaxRoleDesc})
	}
	if in.Base != domain.RoleAdmin && in.Base != domain.RoleMember && in.Base != domain.RoleViewer {
		v.Add("base", validation.OneOf, nil)
	}
	switch strings.ToLower(in.Name) {
	case "owner", "admin", "member", "viewer":
		v.Add("name", validation.OneOf, nil) // the names of the built-in roles are taken
	}
	kept, dropped := domain.Clean(in.Permissions)
	if len(dropped) > 0 {
		v.Add("permissions", validation.OneOf, nil)
	}
	in.Permissions = kept
	if err := v.Err(); err != nil {
		return err
	}
	if acc.Role != domain.RoleOwner && !acc.Role.AtLeast(in.Base) {
		return apperr.New(domain.ErrInsufficientRole, "a role cannot rank above your own")
	}
	return canGrant(acc, kept)
}

// CreateRole defines a custom role.
func (s *Service) CreateRole(ctx context.Context, actor, ws uuid.UUID, in RoleInput) (domain.CustomRole, error) {
	acc, err := s.authorize(ctx, s.repo, ws, actor, domain.PermRoles)
	if err != nil {
		return domain.CustomRole{}, err
	}
	if err := s.checkRole(ctx, acc, &in); err != nil {
		return domain.CustomRole{}, err
	}
	existing, err := s.repo.CustomRoles(ctx, ws)
	if err != nil {
		return domain.CustomRole{}, err
	}
	if len(existing) >= MaxCustomRoles {
		return domain.CustomRole{}, apperr.New(domain.ErrTooManyRoles, "too many custom roles")
	}
	var out domain.CustomRole
	err = s.repo.InTx(ctx, func(tx *repository.Repo) error {
		var err error
		if out, err = tx.CreateCustomRole(ctx, ws, in.Name, in.Description, in.Base, in.Permissions); err != nil {
			return err
		}
		return tx.AddAudit(ctx, ws, actor, "role.created", map[string]any{"name": in.Name})
	})
	return out, err
}

func (s *Service) roleIn(ctx context.Context, actor, ws, id uuid.UUID) (domain.Access, domain.CustomRole, error) {
	acc, err := s.authorize(ctx, s.repo, ws, actor, domain.PermRoles)
	if err != nil {
		return acc, domain.CustomRole{}, err
	}
	c, err := s.repo.CustomRole(ctx, id)
	if err != nil || c.WorkspaceID != ws {
		return acc, domain.CustomRole{}, apperr.New(domain.ErrRoleNotFound, "role not found")
	}
	return acc, c, nil
}

// UpdateRole changes a custom role; people who hold it get the new permissions at once.
func (s *Service) UpdateRole(ctx context.Context, actor, ws, id uuid.UUID, in RoleInput) (domain.CustomRole, error) {
	acc, cur, err := s.roleIn(ctx, actor, ws, id)
	if err != nil {
		return domain.CustomRole{}, err
	}
	if err := s.checkRole(ctx, acc, &in); err != nil {
		return domain.CustomRole{}, err
	}
	var out domain.CustomRole
	err = s.repo.InTx(ctx, func(tx *repository.Repo) error {
		var err error
		if out, err = tx.UpdateCustomRole(ctx, id, in.Name, in.Description, in.Base, in.Permissions); err != nil {
			return err
		}
		add, rm := added(cur.Permissions, in.Permissions)
		return tx.AddAudit(ctx, ws, actor, "role.updated", map[string]any{"name": in.Name, "added": add, "removed": rm})
	})
	return out, err
}

// DeleteRole removes a custom role; its people go back to the built-in role it ranked as.
func (s *Service) DeleteRole(ctx context.Context, actor, ws, id uuid.UUID) error {
	_, cur, err := s.roleIn(ctx, actor, ws, id)
	if err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(tx *repository.Repo) error {
		if err := tx.DeleteCustomRole(ctx, id); err != nil {
			return err
		}
		return tx.AddAudit(ctx, ws, actor, "role.deleted", map[string]any{"name": cur.Name})
	})
}

// AssignCustomRole gives a member a custom role (or, with nil, takes it away so their built-in role applies).
func (s *Service) AssignCustomRole(ctx context.Context, actor, ws, target uuid.UUID, roleID *uuid.UUID) error {
	return s.repo.InTx(ctx, func(tx *repository.Repo) error {
		acc, err := s.authorize(ctx, tx, ws, actor, domain.PermManageMembers)
		if err != nil {
			return err
		}
		if actor == target && acc.Role != domain.RoleOwner {
			return apperr.New(domain.ErrInsufficientRole, "you cannot change your own role")
		}
		current, err := tx.Role(ctx, ws, target)
		if err != nil {
			return err
		}
		if current == "" {
			return apperr.New(domain.ErrMemberNotFound, "member not found")
		}
		if current == domain.RoleOwner {
			return apperr.New(domain.ErrInsufficientRole, "owners are always owners")
		}
		to := current
		var name string
		if roleID != nil {
			c, err := tx.CustomRole(ctx, *roleID)
			if err != nil || c.WorkspaceID != ws {
				return apperr.New(domain.ErrRoleNotFound, "role not found")
			}
			if err := canGrant(acc, c.Permissions); err != nil {
				return err
			}
			to, name = c.Base, c.Name
		}
		if !domain.CanAssign(acc.Role, current, to, false) {
			return apperr.New(domain.ErrInsufficientRole, "insufficient role")
		}
		if err := tx.SetMemberRole(ctx, ws, target, to, roleID); err != nil {
			return err
		}
		return tx.AddAudit(ctx, ws, actor, "member.custom_role", map[string]any{"userId": target.String(), "role": name})
	})
}
