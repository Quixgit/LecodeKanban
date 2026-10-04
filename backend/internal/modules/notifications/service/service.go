// Package service turns events into notifications and serves the bell.
package service

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
)

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

// Cards tells who works on a card (an event consumer's question, already past authorisation).
type Cards interface {
	AssigneeIDs(ctx context.Context, card uuid.UUID) ([]uuid.UUID, error)
	Brief(ctx context.Context, id uuid.UUID) (carddomain.Ref, error)
}

type Projects interface {
	Ref(ctx context.Context, id uuid.UUID) (projectsdomain.Ref, error)
}

// Hints publishes change hints to browsers (nil disables them).
type Hints interface {
	Publish(ctx context.Context, m realtime.Message)
}

type Service struct {
	repo     *repository.Repo
	ws       Workspaces
	users    Users
	cards    Cards
	projects Projects
	hints    Hints
}

func New(repo *repository.Repo, ws Workspaces, users Users, cards Cards, projects Projects, hints Hints) *Service {
	return &Service{repo: repo, ws: ws, users: users, cards: cards, projects: projects, hints: hints}
}

const (
	defaultLimit = 30
	maxLimit     = 100
)

// Item is a notification with its actor resolved.
type Item struct {
	domain.Notification
	Actor *usersdomain.User
}

type Page struct {
	Items  []Item
	Unread int
	Next   *time.Time
}

// List returns the caller's notifications in a workspace, newest first.
func (s *Service) List(ctx context.Context, user, ws uuid.UUID, before *time.Time, limit int) (Page, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return Page{}, err
	}
	if limit <= 0 {
		limit = defaultLimit
	}
	limit = min(limit, maxLimit)
	rows, err := s.repo.List(ctx, user, ws, before, limit+1)
	if err != nil {
		return Page{}, err
	}
	var next *time.Time
	if len(rows) > limit {
		rows = rows[:limit]
		t := rows[limit-1].CreatedAt
		next = &t
	}
	unread, err := s.repo.Unread(ctx, user, ws)
	if err != nil {
		return Page{}, err
	}
	var ids []uuid.UUID
	for _, n := range rows {
		if n.ActorID != nil && !slices.Contains(ids, *n.ActorID) {
			ids = append(ids, *n.ActorID)
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return Page{}, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	items := make([]Item, len(rows))
	for i, n := range rows {
		items[i] = Item{Notification: n}
		if n.ActorID != nil {
			if u, ok := people[*n.ActorID]; ok {
				items[i].Actor = &u
			}
		}
	}
	return Page{Items: items, Unread: unread, Next: next}, nil
}

// MarkRead marks the given notifications of the caller (or every one when all is set) as read.
func (s *Service) MarkRead(ctx context.Context, user, ws uuid.UUID, ids []uuid.UUID, all bool) error {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return err
	}
	if all {
		err := s.repo.MarkAllRead(ctx, user, ws)
		s.hint(ctx, ws, user, nil)
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	err := s.repo.MarkRead(ctx, user, ws, ids)
	s.hint(ctx, ws, user, nil)
	return err
}

// Notify records one notification and tells the person's browsers. A person is never notified of
// their own action.
func (s *Service) Notify(ctx context.Context, n domain.Notification) error {
	if n.ActorID != nil && *n.ActorID == n.UserID {
		return nil
	}
	if _, err := s.repo.Insert(ctx, n); err != nil {
		return err
	}
	s.hint(ctx, n.WorkspaceID, n.UserID, n.ActorID)
	return nil
}

func (s *Service) hint(ctx context.Context, ws, user uuid.UUID, actor *uuid.UUID) {
	if s.hints == nil {
		return
	}
	s.hints.Publish(ctx, realtime.Message{Type: "notification", WorkspaceID: ws, ActorID: actor, UserID: &user})
}

// CardTitle is "KEY-12 Title" for a card an event is about.
func (s *Service) CardTitle(c cardevents.Card) string {
	key := ""
	if s.projects != nil {
		if p, err := s.projects.Ref(context.Background(), c.ProjectID); err == nil {
			key = p.Key
		}
	}
	if key == "" {
		return fmt.Sprintf("#%d %s", c.Number, c.Title)
	}
	return fmt.Sprintf("%s-%d %s", key, c.Number, c.Title)
}

// CardTitleByID is CardTitle for a card known only by id ("" when it cannot be found).
func (s *Service) CardTitleByID(ctx context.Context, id uuid.UUID) string {
	r, err := s.cards.Brief(ctx, id)
	if err != nil {
		return ""
	}
	return s.CardTitle(cardevents.Card{CardID: r.ID, ProjectID: r.ProjectID, WorkspaceID: r.WorkspaceID, Number: r.Number, Title: r.Title})
}
