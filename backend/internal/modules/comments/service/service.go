// Package service implements comment use cases: authorisation follows the card
// (cards module), mentions are limited to workspace members.
package service

import (
	"context"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/repository"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Cards authorises access to a card (cards module).
type Cards interface {
	Ref(ctx context.Context, user, card uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Role, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo  *repository.Repo
	cards Cards
	ws    Workspaces
	users Users
	bus   *eventbus.Bus
}

func New(repo *repository.Repo, cards Cards, ws Workspaces, users Users, bus *eventbus.Bus) *Service {
	return &Service{repo: repo, cards: cards, ws: ws, users: users, bus: bus}
}

// View is a comment with its author and mentioned users resolved.
type View struct {
	domain.Comment
	Author    *usersdomain.User
	Mentioned []usersdomain.User
}

func (s *Service) present(ctx context.Context, cs []domain.Comment) ([]View, error) {
	ids := []uuid.UUID{}
	for _, c := range cs {
		if c.AuthorID != nil && !slices.Contains(ids, *c.AuthorID) {
			ids = append(ids, *c.AuthorID)
		}
		for _, m := range c.Mentions {
			if !slices.Contains(ids, m) {
				ids = append(ids, m)
			}
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	out := make([]View, len(cs))
	for i, c := range cs {
		v := View{Comment: c, Mentioned: []usersdomain.User{}}
		if c.AuthorID != nil {
			if u, ok := people[*c.AuthorID]; ok {
				v.Author = &u
			}
		}
		for _, m := range c.Mentions {
			if u, ok := people[m]; ok {
				v.Mentioned = append(v.Mentioned, u)
			}
		}
		out[i] = v
	}
	return out, nil
}

func (s *Service) presentOne(ctx context.Context, c domain.Comment) (View, error) {
	v, err := s.present(ctx, []domain.Comment{c})
	if err != nil {
		return View{}, err
	}
	return v[0], nil
}

// List returns a card's comments, oldest first.
func (s *Service) List(ctx context.Context, user, card uuid.UUID) ([]View, error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermView); err != nil {
		return nil, err
	}
	cs, err := s.repo.List(ctx, card)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, cs)
}

func validateBody(body *string) error {
	*body = strings.TrimSpace(*body)
	var v validation.V
	if v.Required("body", *body) && utf8.RuneCountInString(*body) > domain.MaxBodyLen {
		v.Add("body", validation.MaxLength, map[string]any{"max": domain.MaxBodyLen})
	}
	return v.Err()
}

// members keeps only mentioned users who belong to the workspace.
func (s *Service) members(ctx context.Context, ws uuid.UUID, ids []uuid.UUID) ([]uuid.UUID, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := []uuid.UUID{}
	for _, id := range ids {
		if _, ok := roles[id]; ok {
			out = append(out, id)
		}
	}
	return out, nil
}

func excerpt(body string) string {
	r := []rune(body)
	if len(r) > 140 {
		return string(r[:140]) + "…"
	}
	return body
}

func evComment(c domain.Comment, card carddomain.Ref, actor uuid.UUID, count int) events.Comment {
	return events.Comment{CommentID: c.ID, CardID: card.ID, ProjectID: card.ProjectID, WorkspaceID: card.WorkspaceID,
		ActorID: actor, CardNumber: card.Number, CardTitle: card.Title, Count: count}
}

// Create posts a comment (members and above).
func (s *Service) Create(ctx context.Context, user, cardID uuid.UUID, body string) (View, error) {
	card, err := s.cards.Ref(ctx, user, cardID, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	if err := validateBody(&body); err != nil {
		return View{}, err
	}
	mentions, err := s.members(ctx, card.WorkspaceID, domain.ParseMentions(body))
	if err != nil {
		return View{}, err
	}
	var c domain.Comment
	var count int
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if c, err = r.Create(ctx, card.WorkspaceID, cardID, user, body); err != nil {
			return err
		}
		if err = r.SetMentions(ctx, c.ID, mentions); err != nil {
			return err
		}
		count, err = r.Count(ctx, cardID)
		return err
	})
	if err != nil {
		return View{}, err
	}
	c.Mentions = mentions
	_ = s.bus.Publish(ctx, events.CommentCreated{Comment: evComment(c, card, user, count), Excerpt: excerpt(body), Mentions: mentions})
	return s.presentOne(ctx, c)
}

// load fetches a comment and authorises perm on its card; inaccessible comments are not found.
func (s *Service) load(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Comment, carddomain.Ref, error) {
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Comment{}, carddomain.Ref{}, err
	}
	card, err := s.cards.Ref(ctx, user, c.CardID, perm)
	if apperr.IsCode(err, carddomain.ErrNotFound) {
		return domain.Comment{}, carddomain.Ref{}, apperr.New(domain.ErrNotFound, "comment not found")
	}
	return c, card, err
}

// Update edits the caller's own comment.
func (s *Service) Update(ctx context.Context, user, id uuid.UUID, body string) (View, error) {
	cur, card, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	if cur.AuthorID == nil || *cur.AuthorID != user {
		return View{}, apperr.New(domain.ErrForbidden, "only the author can edit a comment")
	}
	if err := validateBody(&body); err != nil {
		return View{}, err
	}
	mentions, err := s.members(ctx, card.WorkspaceID, domain.ParseMentions(body))
	if err != nil {
		return View{}, err
	}
	var c domain.Comment
	var count int
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if c, err = r.Update(ctx, id, body); err != nil {
			return err
		}
		if err = r.SetMentions(ctx, id, mentions); err != nil {
			return err
		}
		count, err = r.Count(ctx, c.CardID)
		return err
	})
	if err != nil {
		return View{}, err
	}
	c.Mentions = mentions
	fresh := []uuid.UUID{}
	for _, m := range mentions {
		if !slices.Contains(cur.Mentions, m) {
			fresh = append(fresh, m)
		}
	}
	_ = s.bus.Publish(ctx, events.CommentUpdated{Comment: evComment(c, card, user, count), NewMentions: fresh})
	return s.presentOne(ctx, c)
}

// Delete removes a comment: its author, or a workspace admin/owner.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	c, card, err := s.load(ctx, user, id, wsdomain.PermView)
	if err != nil {
		return err
	}
	if c.AuthorID == nil || *c.AuthorID != user {
		role, err := s.ws.Authorize(ctx, card.WorkspaceID, user, wsdomain.PermView)
		if err != nil {
			return err
		}
		if !role.AtLeast(wsdomain.RoleAdmin) {
			return apperr.New(domain.ErrForbidden, "only the author or an admin can delete a comment")
		}
	} else if _, err := s.ws.Authorize(ctx, card.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		return err
	}
	var count int
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.Delete(ctx, id); err != nil {
			return err
		}
		var err error
		count, err = r.Count(ctx, c.CardID)
		return err
	})
	if err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.CommentDeleted{Comment: evComment(c, card, user, count)})
	return nil
}
