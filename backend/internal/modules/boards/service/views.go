package service

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

func validateView(v *validation.V, name *string, config json.RawMessage) {
	if name != nil {
		*name = strings.TrimSpace(*name)
		if v.Required("name", *name) {
			v.Length("name", *name, 1, 60)
		}
	}
	if config != nil {
		var obj map[string]any
		if len(config) > domain.MaxViewConfigLen {
			v.Add("config", validation.MaxLength, map[string]any{"max": domain.MaxViewConfigLen})
		} else if json.Unmarshal(config, &obj) != nil || obj == nil {
			v.Add("config", validation.Required, nil)
		}
	}
}

// Views lists the caller's saved views in a workspace.
func (s *Service) Views(ctx context.Context, user, ws uuid.UUID) ([]domain.SavedView, error) {
	if _, err := s.auth.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Views(ctx, ws, user)
}

// CreateView saves a personal view (viewers too: it changes nothing shared).
func (s *Service) CreateView(ctx context.Context, user, ws uuid.UUID, name string, config json.RawMessage) (domain.SavedView, error) {
	if _, err := s.auth.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return domain.SavedView{}, err
	}
	var v validation.V
	validateView(&v, &name, config)
	if config == nil {
		v.Add("config", validation.Required, nil)
	}
	if err := v.Err(); err != nil {
		return domain.SavedView{}, err
	}
	n, err := s.repo.CountViews(ctx, ws, user)
	if err != nil {
		return domain.SavedView{}, err
	}
	if n >= domain.MaxViewsPerUser {
		v.Add("name", validation.Count, map[string]any{"min": 0, "max": domain.MaxViewsPerUser})
		return domain.SavedView{}, v.Err()
	}
	return s.repo.CreateView(ctx, ws, user, name, config)
}

// checkOwner allows only the view's owner (still a workspace member); others get not_found.
func (s *Service) checkOwner(ctx context.Context, user, id uuid.UUID) error {
	sv, err := s.repo.View(ctx, id)
	if err != nil {
		return err
	}
	if sv.UserID != user {
		return apperr.New(domain.ErrViewNotFound, "view not found")
	}
	if _, err := s.auth.Authorize(ctx, sv.WorkspaceID, user, wsdomain.PermView); err != nil {
		return apperr.New(domain.ErrViewNotFound, "view not found")
	}
	return nil
}

func (s *Service) UpdateView(ctx context.Context, user, id uuid.UUID, name *string, config json.RawMessage) (domain.SavedView, error) {
	if err := s.checkOwner(ctx, user, id); err != nil {
		return domain.SavedView{}, err
	}
	var v validation.V
	validateView(&v, name, config)
	if err := v.Err(); err != nil {
		return domain.SavedView{}, err
	}
	return s.repo.UpdateView(ctx, id, name, config)
}

func (s *Service) DeleteView(ctx context.Context, user, id uuid.UUID) error {
	if err := s.checkOwner(ctx, user, id); err != nil {
		return err
	}
	return s.repo.DeleteView(ctx, id)
}
