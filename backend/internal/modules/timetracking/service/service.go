// Package service implements time tracking; authorisation follows the card (cards module).
package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/repository"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type Cards interface {
	Ref(ctx context.Context, user, card uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
	Policy(ctx context.Context, ws uuid.UUID) (wsdomain.Settings, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo  *repository.Repo
	cards Cards
	ws    Workspaces
	users Users
	now   func() time.Time
}

func New(repo *repository.Repo, cards Cards, ws Workspaces, users Users) *Service {
	return &Service{repo: repo, cards: cards, ws: ws, users: users, now: time.Now}
}

// View is an entry with its author resolved and the elapsed time computed.
type View struct {
	domain.Entry
	User    *usersdomain.User
	Elapsed int
}

// Summary is a card's time log with the total (running timers included).
type Summary struct {
	Entries      []View
	TotalSeconds int
}

func (s *Service) present(ctx context.Context, es []domain.Entry) ([]View, error) {
	ids := []uuid.UUID{}
	for _, e := range es {
		ids = append(ids, e.UserID)
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
	now := s.now()
	out := make([]View, len(es))
	for i, e := range es {
		out[i] = View{Entry: e, Elapsed: e.Elapsed(now)}
		if u, ok := people[e.UserID]; ok {
			out[i].User = &u
		}
	}
	return out, nil
}

// List returns a card's entries, newest first.
func (s *Service) List(ctx context.Context, user, card uuid.UUID) (Summary, error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermView); err != nil {
		return Summary{}, err
	}
	es, err := s.repo.List(ctx, card)
	if err != nil {
		return Summary{}, err
	}
	views, err := s.present(ctx, es)
	if err != nil {
		return Summary{}, err
	}
	sum := Summary{Entries: views}
	for _, v := range views {
		sum.TotalSeconds += v.Elapsed
	}
	return sum, nil
}

// Running returns the user's running timer, if any.
func (s *Service) Running(ctx context.Context, user uuid.UUID) (*View, error) {
	e, ok, err := s.repo.Running(ctx, user)
	if err != nil || !ok {
		return nil, err
	}
	vs, err := s.present(ctx, []domain.Entry{e})
	if err != nil {
		return nil, err
	}
	return &vs[0], nil
}

// Start begins a timer on a card, stopping the user's previous one (there is only one at a time).
func (s *Service) Start(ctx context.Context, user, card uuid.UUID) (View, error) {
	ref, err := s.cards.Ref(ctx, user, card, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	var e domain.Entry
	now := s.now()
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if err := r.StopRunning(ctx, user, now); err != nil {
			return err
		}
		e, err = r.Start(ctx, ref.WorkspaceID, card, user, now)
		return err
	})
	if err != nil {
		return View{}, err
	}
	return s.one(ctx, e)
}

// Stop ends the user's own running timer.
func (s *Service) Stop(ctx context.Context, user, id uuid.UUID) (View, error) {
	cur, err := s.repo.Get(ctx, id)
	if err != nil {
		return View{}, err
	}
	if cur.UserID != user {
		return View{}, apperr.New(domain.ErrNotFound, "time entry not found")
	}
	e, err := s.repo.Stop(ctx, id, s.now())
	if err != nil {
		return View{}, err
	}
	return s.one(ctx, e)
}

// LogInput records time after the fact.
type LogInput struct {
	Seconds   int
	Note      string
	StartedAt *time.Time // defaults to "Seconds ago"
}

func (s *Service) Log(ctx context.Context, user, card uuid.UUID, in LogInput) (View, error) {
	ref, err := s.cards.Ref(ctx, user, card, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	policy, err := s.ws.Policy(ctx, ref.WorkspaceID)
	if err != nil {
		return View{}, err
	}
	if !policy.TimeAllowManual {
		return View{}, apperr.New(wsdomain.ErrPolicy, "logging time by hand is switched off in this workspace")
	}
	in.Note = strings.TrimSpace(in.Note)
	var v validation.V
	if in.Seconds < domain.MinManualSeconds || in.Seconds > domain.MaxManualSeconds {
		v.Add("seconds", validation.Range, map[string]any{"min": domain.MinManualSeconds, "max": domain.MaxManualSeconds})
	}
	v.Length("note", in.Note, 0, domain.MaxNote)
	now := s.now()
	if in.StartedAt != nil && in.StartedAt.Add(time.Duration(in.Seconds)*time.Second).After(now.Add(time.Minute)) {
		v.Add("startedAt", validation.Range, map[string]any{"max": "now"})
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	start := now.Add(-time.Duration(in.Seconds) * time.Second)
	if in.StartedAt != nil {
		start = *in.StartedAt
	}
	e, err := s.repo.Log(ctx, repository.Log{WorkspaceID: ref.WorkspaceID, CardID: card, UserID: user,
		StartedAt: start, Seconds: in.Seconds, Note: in.Note})
	if err != nil {
		return View{}, err
	}
	return s.one(ctx, e)
}

// Delete removes an entry: its author, or a workspace admin.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	e, err := s.repo.Get(ctx, id)
	if err != nil {
		return err
	}
	role, err := s.ws.Authorize(ctx, e.WorkspaceID, user, wsdomain.PermEditContent)
	if err != nil {
		return apperr.New(domain.ErrNotFound, "time entry not found")
	}
	if e.UserID != user && !role.Can(wsdomain.PermTimeManage) {
		return apperr.New(domain.ErrForbidden, "only the author or an admin can delete a time entry")
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) one(ctx context.Context, e domain.Entry) (View, error) {
	vs, err := s.present(ctx, []domain.Entry{e})
	if err != nil {
		return View{}, err
	}
	return vs[0], nil
}
