package service

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

func (s *Service) Get(ctx context.Context, user, id uuid.UUID) (View, error) {
	c, err := s.load(ctx, user, id, wsdomain.PermView)
	if err != nil {
		return View{}, err
	}
	return s.presentOne(ctx, c)
}

func (s *Service) List(ctx context.Context, user, ws uuid.UUID, f domain.Filter, pg pagination.Params) ([]View, int, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, 0, err
	}
	cards, total, err := s.repo.List(ctx, ws, f, s.today(), pg)
	if err != nil {
		return nil, 0, err
	}
	views, err := s.present(ctx, cards)
	return views, total, err
}

// Board returns every card matching f in board order (capped; truncated reports the cap was hit).
func (s *Service) Board(ctx context.Context, user, ws uuid.UUID, f domain.Filter) (views []View, truncated bool, err error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, false, err
	}
	cards, truncated, err := s.repo.Board(ctx, ws, f, s.today())
	if err != nil {
		return nil, false, err
	}
	views, err = s.present(ctx, cards)
	return views, truncated, err
}

func (s *Service) Counts(ctx context.Context, user, ws uuid.UUID, f domain.Filter) (domain.Counts, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Counts(ctx, ws, f, s.today())
}

// StatsView is dashboard data with activity resolved for display.
type StatsView struct {
	domain.Stats
	Projects map[uuid.UUID]projectsdomain.Ref
	Actors   map[uuid.UUID]usersdomain.User
}

func (s *Service) Stats(ctx context.Context, user, ws uuid.UUID, days int) (StatsView, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return StatsView{}, err
	}
	if days < 7 || days > 31 {
		days = 7
	}
	st, err := s.repo.Stats(ctx, ws, s.today(), days)
	if err != nil {
		return StatsView{}, err
	}
	projectIDs, actorIDs := []uuid.UUID{}, []uuid.UUID{}
	for _, t := range st.Activity {
		if !slices.Contains(projectIDs, t.ProjectID) {
			projectIDs = append(projectIDs, t.ProjectID)
		}
		if t.ActorID != nil && !slices.Contains(actorIDs, *t.ActorID) {
			actorIDs = append(actorIDs, *t.ActorID)
		}
	}
	refs, err := s.projects.Refs(ctx, projectIDs)
	if err != nil {
		return StatsView{}, err
	}
	actors := map[uuid.UUID]usersdomain.User{}
	if len(actorIDs) > 0 {
		us, err := s.users.GetMany(ctx, actorIDs)
		if err != nil {
			return StatsView{}, err
		}
		for _, u := range us {
			actors[u.ID] = u
		}
	}
	return StatsView{Stats: st, Projects: refs, Actors: actors}, nil
}
