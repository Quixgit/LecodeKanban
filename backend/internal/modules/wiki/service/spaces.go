package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// SpaceInput creates a space; empty fields take defaults (private, viewer, depth 12).
type SpaceInput struct {
	Name          string
	Icon, Color   string
	Description   string
	Visibility    domain.Visibility
	WorkspaceRole domain.Role
	MaxDepth      int
}

// SpacePatch updates a space; nil leaves a field as is.
type SpacePatch struct {
	Name, Icon, Color, Description *string
	MaxDepth                       *int
}

// SpaceView is a space with the caller's access.
type SpaceView struct {
	Space  domain.Space
	Access domain.Access
}

func validWorkspaceRole(v *validation.V, field string, r domain.Role) {
	v.OneOf(field, string(r), string(domain.RoleViewer), string(domain.RoleCommenter), string(domain.RoleEditor))
}

func validateSpace(name, icon, color, desc string, depth int) (string, error) {
	name = strings.TrimSpace(name)
	var v validation.V
	if v.Required("name", name) {
		v.Length("name", name, 1, domain.MaxSpaceName)
	}
	v.Length("icon", icon, 0, 40)
	v.Length("color", color, 0, 20)
	v.Length("description", desc, 0, 500)
	if depth < 2 || depth > 32 {
		v.Add("maxDepth", validation.Range, map[string]any{"min": 2, "max": 32})
	}
	return name, v.Err()
}

// CreateSpace makes a new top-level container owned by the caller.
func (s *Service) CreateSpace(ctx context.Context, user, ws uuid.UUID, in SpaceInput) (SpaceView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return SpaceView{}, err
	}
	if in.Visibility == "" {
		in.Visibility = domain.Private
	}
	if in.WorkspaceRole == "" {
		in.WorkspaceRole = domain.RoleViewer
	}
	if in.MaxDepth == 0 {
		in.MaxDepth = domain.DefaultMaxDepth
	}
	name, err := validateSpace(in.Name, in.Icon, in.Color, in.Description, in.MaxDepth)
	var v validation.V
	v.OneOf("visibility", string(in.Visibility), string(domain.Private), string(domain.Shared), string(domain.Workspace))
	validWorkspaceRole(&v, "workspaceRole", in.WorkspaceRole)
	if err == nil {
		err = v.Err()
	}
	if err != nil {
		return SpaceView{}, err
	}
	var sp domain.Space
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		sp, err = r.CreateSpace(ctx, repository.NewSpace{WorkspaceID: ws, OwnerID: user, Name: name, Icon: in.Icon,
			Color: in.Color, Description: in.Description, Visibility: in.Visibility, WorkspaceRole: in.WorkspaceRole,
			MaxDepth: in.MaxDepth})
		if err != nil {
			return err
		}
		return s.audit(ctx, r, ws, &sp.ID, nil, user, domain.AuditSpaceCreated,
			map[string]any{"name": sp.Name, "visibility": string(sp.Visibility)})
	})
	if err != nil {
		return SpaceView{}, err
	}
	sc, err := s.loadSpace(ctx, user, sp.ID)
	if err != nil {
		return SpaceView{}, err
	}
	return SpaceView{Space: sp, Access: sc.access}, nil
}

// Spaces lists the spaces the caller can open.
func (s *Service) Spaces(ctx context.Context, user, ws uuid.UUID) ([]SpaceView, error) {
	sub, err := s.subject(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	all, err := s.repo.Spaces(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := []SpaceView{}
	for _, sp := range all {
		perms, err := s.repo.ChainPermissions(ctx, sp.ID, nil)
		if err != nil {
			return nil, err
		}
		a := domain.Resolve(sub, []domain.Element{spaceElement(sp, toGrants(perms)[uuid.Nil])})
		if a.Role.AtLeast(domain.RoleViewer) {
			out = append(out, SpaceView{Space: sp, Access: a})
		}
	}
	return out, nil
}

func (s *Service) Space(ctx context.Context, user, id uuid.UUID) (SpaceView, error) {
	sc, err := s.loadSpace(ctx, user, id)
	if err != nil {
		return SpaceView{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return SpaceView{}, err
	}
	return SpaceView{Space: sc.space, Access: sc.access}, nil
}

// UpdateSpace changes name, look and depth limit; settings need the owner role.
func (s *Service) UpdateSpace(ctx context.Context, user, id uuid.UUID, p SpacePatch) (SpaceView, error) {
	sc, err := s.loadSpace(ctx, user, id)
	if err != nil {
		return SpaceView{}, err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return SpaceView{}, err
	}
	sp := sc.space
	if p.Name != nil {
		sp.Name = *p.Name
	}
	if p.Icon != nil {
		sp.Icon = *p.Icon
	}
	if p.Color != nil {
		sp.Color = *p.Color
	}
	if p.Description != nil {
		sp.Description = *p.Description
	}
	if p.MaxDepth != nil {
		sp.MaxDepth = *p.MaxDepth
	}
	if sp.Name, err = validateSpace(sp.Name, sp.Icon, sp.Color, sp.Description, sp.MaxDepth); err != nil {
		return SpaceView{}, err
	}
	if sp.MaxDepth < sc.space.MaxDepth {
		deepest, err := s.deepestInSpace(ctx, sp.ID)
		if err != nil {
			return SpaceView{}, err
		}
		if deepest > sp.MaxDepth {
			return SpaceView{}, apperr.New(domain.ErrMaxDepth, "space already nests deeper").WithMeta("deepest", deepest)
		}
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if sp, err = r.UpdateSpace(ctx, sp); err != nil {
			return err
		}
		return s.audit(ctx, r, sp.WorkspaceID, &sp.ID, nil, user, domain.AuditSpaceUpdated, map[string]any{"name": sp.Name})
	})
	if err != nil {
		return SpaceView{}, err
	}
	return SpaceView{Space: sp, Access: sc.access}, nil
}

func (s *Service) deepestInSpace(ctx context.Context, space uuid.UUID) (int, error) {
	rows, err := s.repo.SpaceNodes(ctx, space)
	if err != nil {
		return 0, err
	}
	deepest := 0
	for _, n := range rows {
		deepest = max(deepest, n.Depth)
	}
	return deepest, nil
}

// DeleteSpace permanently removes a space and everything in it.
func (s *Service) DeleteSpace(ctx context.Context, user, id uuid.UUID) error {
	sc, err := s.loadSpace(ctx, user, id)
	if err != nil {
		return err
	}
	if err := sc.need(domain.CapManage); err != nil {
		return err
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.DeleteSpace(ctx, id); err != nil {
			return err
		}
		return s.audit(ctx, r, sc.space.WorkspaceID, &id, nil, user, domain.AuditSpaceDeleted, map[string]any{"name": sc.space.Name})
	})
}
