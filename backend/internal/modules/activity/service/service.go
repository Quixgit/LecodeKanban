// Package service records activity (driven by other modules' events, wired in cmd/server)
// and serves per-card feeds.
package service

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/repository"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

type Cards interface {
	Ref(ctx context.Context, user, card uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo  *repository.Repo
	cards Cards
	users Users
}

func New(repo *repository.Repo, cards Cards, users Users) *Service {
	return &Service{repo: repo, cards: cards, users: users}
}

// Record appends an entry (no authorisation: callers are event handlers of trusted modules).
func (s *Service) Record(ctx context.Context, e domain.Entry) error { return s.repo.Insert(ctx, e) }

// View is an entry with its actor resolved.
type View struct {
	domain.Entry
	Actor *usersdomain.User
}

// CardFeed returns a card's activity newest first; more reports older entries exist
// (page by passing the last id as before).
func (s *Service) CardFeed(ctx context.Context, user, card uuid.UUID, before *int64, limit int) (views []View, more bool, err error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermView); err != nil {
		return nil, false, err
	}
	if limit < 1 || limit > domain.MaxPage {
		limit = 50
	}
	es, err := s.repo.ForCard(ctx, card, before, limit+1)
	if err != nil {
		return nil, false, err
	}
	if len(es) > limit {
		es, more = es[:limit], true
	}
	ids := []uuid.UUID{}
	for _, e := range es {
		if e.ActorID != nil && !slices.Contains(ids, *e.ActorID) {
			ids = append(ids, *e.ActorID)
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, false, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	out := make([]View, len(es))
	for i, e := range es {
		out[i] = View{Entry: e}
		if e.ActorID != nil {
			if u, ok := people[*e.ActorID]; ok {
				out[i].Actor = &u
			}
		}
	}
	return out, more, nil
}
