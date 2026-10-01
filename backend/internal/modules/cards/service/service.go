// Package service implements card (task) use cases.
package service

import (
	"context"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	boardsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Role, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
}

type Projects interface {
	Ref(ctx context.Context, id uuid.UUID) (projectsdomain.Ref, error)
	Refs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]projectsdomain.Ref, error)
}

type Boards interface {
	Column(ctx context.Context, id uuid.UUID) (boardsdomain.Column, error)
	FirstColumn(ctx context.Context, project uuid.UUID, cat boardsdomain.Category) (boardsdomain.Column, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo     *repository.Repo
	ws       Workspaces
	projects Projects
	boards   Boards
	users    Users
	bus      *eventbus.Bus
	now      func() time.Time
}

func New(repo *repository.Repo, ws Workspaces, projects Projects, boards Boards, users Users, bus *eventbus.Bus) *Service {
	return &Service{repo: repo, ws: ws, projects: projects, boards: boards, users: users, bus: bus, now: time.Now}
}

func (s *Service) today() time.Time {
	y, m, d := s.now().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// View is a card with project and assignee data resolved.
type View struct {
	domain.Card
	Key       string
	Project   projectsdomain.Ref
	Assignees []usersdomain.User
}

func (s *Service) present(ctx context.Context, cards []domain.Card) ([]View, error) {
	ids := make([]uuid.UUID, len(cards))
	projectIDs := []uuid.UUID{}
	for i, c := range cards {
		ids[i] = c.ID
		if !slices.Contains(projectIDs, c.ProjectID) {
			projectIDs = append(projectIDs, c.ProjectID)
		}
	}
	assignees, err := s.repo.Assignees(ctx, ids)
	if err != nil {
		return nil, err
	}
	userIDs := []uuid.UUID{}
	for _, list := range assignees {
		for _, u := range list {
			if !slices.Contains(userIDs, u) {
				userIDs = append(userIDs, u)
			}
		}
	}
	refs, err := s.projects.Refs(ctx, projectIDs)
	if err != nil {
		return nil, err
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(userIDs) > 0 {
		us, err := s.users.GetMany(ctx, userIDs)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	out := make([]View, len(cards))
	for i, c := range cards {
		ref := refs[c.ProjectID]
		v := View{Card: c, Project: ref, Key: ref.Key + "-" + strconv.Itoa(c.Number), Assignees: []usersdomain.User{}}
		for _, uid := range assignees[c.ID] {
			v.Card.Assignees = append(v.Card.Assignees, uid)
			if u, ok := people[uid]; ok {
				v.Assignees = append(v.Assignees, u)
			}
		}
		slices.SortFunc(v.Assignees, func(a, b usersdomain.User) int {
			if a.Name < b.Name {
				return -1
			}
			if a.Name > b.Name {
				return 1
			}
			return 0
		})
		out[i] = v
	}
	return out, nil
}

func (s *Service) presentOne(ctx context.Context, c domain.Card) (View, error) {
	v, err := s.present(ctx, []domain.Card{c})
	if err != nil {
		return View{}, err
	}
	return v[0], nil
}

// load fetches a card and authorises perm in its workspace; non-members get not_found.
func (s *Service) load(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Card, error) {
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Card{}, err
	}
	if _, err := s.ws.Authorize(ctx, c.WorkspaceID, user, perm); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Card{}, apperr.New(domain.ErrNotFound, "card not found")
		}
		return domain.Card{}, err
	}
	if _, err := s.projects.Ref(ctx, c.ProjectID); err != nil {
		if apperr.IsCode(err, projectsdomain.ErrNotFound) {
			return domain.Card{}, apperr.New(domain.ErrNotFound, "card not found") // project archived
		}
		return domain.Card{}, err
	}
	return c, nil
}

// CountByProject feeds the projects module's progress counters.
func (s *Service) CountByProject(ctx context.Context, project uuid.UUID) (int, int, error) {
	return s.repo.CountByProject(ctx, project)
}
