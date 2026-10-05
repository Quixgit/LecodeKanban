package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Trash lists the deleted tasks of a workspace (or one project), newest first. Whoever may delete tasks may look
// into the trash and bring them back.
func (s *Service) Trash(ctx context.Context, user, ws uuid.UUID, project *uuid.UUID) ([]View, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermTasksDelete); err != nil {
		return nil, err
	}
	cards, err := s.repo.Trash(ctx, ws, project)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, cards)
}

// Restore brings a deleted task back, with the subtasks that were deleted with it. It refuses when the task's
// project is gone or its parent task is still in the trash (restore the parent first).
func (s *Service) Restore(ctx context.Context, user, id uuid.UUID) (View, error) {
	c, err := s.repo.Archived(ctx, id)
	if err != nil {
		return View{}, err
	}
	if _, err := s.ws.Authorize(ctx, c.WorkspaceID, user, wsdomain.PermTasksDelete); err != nil {
		// Not a member: the task does not exist for them.
		return View{}, apperr.New(domain.ErrNotFound, "card not found")
	}
	if _, err := s.projects.Ref(ctx, c.ProjectID); err != nil {
		return View{}, apperr.New(domain.ErrCannotRestore, "the project of this task no longer exists")
	}
	if c.ParentID != nil {
		if _, err := s.repo.Get(ctx, *c.ParentID); err != nil {
			return View{}, apperr.New(domain.ErrCannotRestore, "restore the parent task first")
		}
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.Restore(ctx, c); err != nil {
			return err
		}
		if _, err := r.RefreshSubtasks(ctx, c.ID); err != nil { // a restored parent counts the subtasks that came back
			return err
		}
		if c.ParentID != nil {
			_, err := r.RefreshSubtasks(ctx, *c.ParentID)
			return err
		}
		return nil
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardRestored{Card: evCard(c, user)})
	fresh, err := s.repo.Get(ctx, id)
	if err != nil {
		return View{}, err
	}
	views, err := s.present(ctx, []domain.Card{fresh})
	if err != nil {
		return View{}, err
	}
	return views[0], nil
}
