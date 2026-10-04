// Package service implements board use cases.
package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
)

// Authorizer checks workspace permissions (workspaces module).
type Authorizer interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

// CardCounter reports and re-homes the cards of a column (cards module, set after construction).
type CardCounter interface {
	CountInColumn(ctx context.Context, column uuid.UUID) (int, error)
	RelocateArchived(ctx context.Context, from, to uuid.UUID) error
}

type Service struct {
	repo  *repository.Repo
	auth  Authorizer
	bus   *eventbus.Bus
	cards CardCounter
}

func New(repo *repository.Repo, auth Authorizer, bus *eventbus.Bus) *Service {
	return &Service{repo: repo, auth: auth, bus: bus}
}

// SetCardCounter breaks the boards ↔ cards construction cycle.
func (s *Service) SetCardCounter(c CardCounter) { s.cards = c }

// EnsureDefault creates the project's board with four columns (idempotent).
func (s *Service) EnsureDefault(ctx context.Context, ws, project uuid.UUID, name, locale string) error {
	names, ok := domain.DefaultColumnNames[locale]
	if !ok {
		names = domain.DefaultColumnNames["en"]
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		b, created, err := r.CreateBoard(ctx, ws, project, name)
		if err != nil || !created {
			return err
		}
		for i, pos := range fractional.Sequence("", len(domain.Categories)) {
			cat := domain.Categories[i]
			if err := r.CreateColumn(ctx, b.ID, names[cat], cat, pos); err != nil {
				return err
			}
		}
		return nil
	})
}

// Board returns a project's board with ordered columns, after checking view access.
func (s *Service) Board(ctx context.Context, user, project uuid.UUID) (domain.Board, error) {
	b, err := s.repo.BoardByProject(ctx, project)
	if err != nil {
		return domain.Board{}, err
	}
	if _, err := s.auth.Authorize(ctx, b.WorkspaceID, user, wsdomain.PermView); err != nil {
		return domain.Board{}, err
	}
	cols, err := s.repo.Columns(ctx, b)
	if err != nil {
		return domain.Board{}, err
	}
	return domain.Board{ID: b.ID, WorkspaceID: b.WorkspaceID, ProjectID: b.ProjectID, Name: b.Name, Columns: cols}, nil
}

// Column returns column metadata (no auth: callers authorise the owning workspace).
func (s *Service) Column(ctx context.Context, id uuid.UUID) (domain.Column, error) {
	return s.repo.Column(ctx, id)
}

// FirstColumn returns the left-most column of a status category in a project.
func (s *Service) FirstColumn(ctx context.Context, project uuid.UUID, cat domain.Category) (domain.Column, error) {
	return s.repo.FirstColumn(ctx, project, cat)
}
