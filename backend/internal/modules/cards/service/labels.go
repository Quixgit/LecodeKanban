package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

const maxLabelsPerWorkspace = 100

func (s *Service) Labels(ctx context.Context, user, ws uuid.UUID) ([]domain.Label, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Labels(ctx, ws)
}

func validateLabel(name, tone *string) error {
	var v validation.V
	if name != nil {
		*name = strings.TrimSpace(*name)
		if v.Required("name", *name) {
			v.Length("name", *name, 1, 40)
		}
	}
	if tone != nil {
		v.OneOf("tone", *tone, domain.LabelTones...)
	}
	return v.Err()
}

// CreateLabel adds a workspace label (members and above).
func (s *Service) CreateLabel(ctx context.Context, user, ws uuid.UUID, name, tone string) (domain.Label, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return domain.Label{}, err
	}
	if tone == "" {
		tone = "teal"
	}
	if err := validateLabel(&name, &tone); err != nil {
		return domain.Label{}, err
	}
	existing, err := s.repo.Labels(ctx, ws)
	if err != nil {
		return domain.Label{}, err
	}
	if len(existing) >= maxLabelsPerWorkspace {
		var v validation.V
		v.Add("name", validation.Count, map[string]any{"min": 0, "max": maxLabelsPerWorkspace})
		return domain.Label{}, v.Err()
	}
	l, err := s.repo.CreateLabel(ctx, ws, name, tone)
	if err != nil {
		return domain.Label{}, err
	}
	_ = s.bus.Publish(ctx, events.LabelsChanged{WorkspaceID: ws, ActorID: user})
	return l, nil
}

func (s *Service) loadLabel(ctx context.Context, user, id uuid.UUID) (domain.Label, error) {
	l, err := s.repo.Label(ctx, id)
	if err != nil {
		return domain.Label{}, err
	}
	if _, err := s.ws.Authorize(ctx, l.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Label{}, apperr.New(domain.ErrLabelNotFound, "label not found")
		}
		return domain.Label{}, err
	}
	return l, nil
}

func (s *Service) UpdateLabel(ctx context.Context, user, id uuid.UUID, name, tone *string) (domain.Label, error) {
	l, err := s.loadLabel(ctx, user, id)
	if err != nil {
		return domain.Label{}, err
	}
	if err := validateLabel(name, tone); err != nil {
		return domain.Label{}, err
	}
	out, err := s.repo.UpdateLabel(ctx, id, name, tone)
	if err != nil {
		return domain.Label{}, err
	}
	_ = s.bus.Publish(ctx, events.LabelsChanged{WorkspaceID: l.WorkspaceID, ActorID: user})
	return out, nil
}

func (s *Service) DeleteLabel(ctx context.Context, user, id uuid.UUID) error {
	l, err := s.loadLabel(ctx, user, id)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteLabel(ctx, id); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.LabelsChanged{WorkspaceID: l.WorkspaceID, ActorID: user})
	return nil
}
