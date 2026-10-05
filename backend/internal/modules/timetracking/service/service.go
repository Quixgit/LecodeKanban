// Package service implements time tracking; authorisation follows the card (cards module).
package service

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
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

// Projects resolves the project of a task for timesheet rows.
type Projects interface {
	Refs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]projectsdomain.Ref, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo     *repository.Repo
	cards    Cards
	ws       Workspaces
	users    Users
	projects Projects
	now      func() time.Time
}

func New(repo *repository.Repo, cards Cards, ws Workspaces, users Users, projects Projects) *Service {
	return &Service{repo: repo, cards: cards, ws: ws, users: users, projects: projects, now: time.Now}
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
	// EstimateSeconds is the expected time of the task, nil when none was set.
	EstimateSeconds *int
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
	if sum.EstimateSeconds, err = s.repo.Estimate(ctx, card); err != nil {
		return Summary{}, err
	}
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

// SetEstimate sets or clears (nil) the time a task is expected to take.
func (s *Service) SetEstimate(ctx context.Context, user, card uuid.UUID, seconds *int) (*int, error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermEditContent); err != nil {
		return nil, err
	}
	if seconds != nil {
		if *seconds < domain.MinEstimateSeconds || *seconds > domain.MaxEstimateSeconds {
			var v validation.V
			v.Add("seconds", validation.Range, map[string]any{"min": domain.MinEstimateSeconds, "max": domain.MaxEstimateSeconds})
			return nil, v.Err()
		}
		// Whole minutes only: an estimate of 90 seconds would read as a rounding bug.
		m := (*seconds + 30) / 60 * 60
		seconds = &m
	}
	return seconds, s.repo.SetEstimate(ctx, card, seconds)
}

// SheetEntry is an entry with its task, for the timesheet.
type SheetEntry struct {
	View
	ProjectID  uuid.UUID
	Project    projectsdomain.Ref
	CardNumber int
	CardTitle  string
}

// Sheet is one person's entries in a period.
type Sheet struct {
	Entries      []SheetEntry
	TotalSeconds int
}

// SheetQuery asks for a person's time between two instants (the client picks them in its own time zone).
type SheetQuery struct {
	From, To  time.Time
	UserID    *uuid.UUID // nil: the caller
	ProjectID *uuid.UUID
}

// Timesheet lists a person's entries. Everyone sees their own; looking at someone else's needs the time-management
// permission, which administrators have.
func (s *Service) Timesheet(ctx context.Context, user, ws uuid.UUID, q SheetQuery) (Sheet, error) {
	access, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView)
	if err != nil {
		return Sheet{}, err
	}
	target := user
	if q.UserID != nil && *q.UserID != user {
		if !access.Can(wsdomain.PermTimeManage) {
			return Sheet{}, apperr.New(domain.ErrForbidden, "only an admin can see other people's time")
		}
		target = *q.UserID
	}
	var v validation.V
	if !q.To.After(q.From) || q.To.Sub(q.From) > time.Duration(domain.MaxSheetDays)*24*time.Hour {
		v.Add("to", validation.Range, map[string]any{"max": domain.MaxSheetDays})
	}
	if err := v.Err(); err != nil {
		return Sheet{}, err
	}
	rows, err := s.repo.Sheet(ctx, ws, repository.SheetFilter{UserID: target, From: q.From, To: q.To, ProjectID: q.ProjectID})
	if err != nil {
		return Sheet{}, err
	}
	entries := make([]domain.Entry, len(rows))
	projectIDs := []uuid.UUID{}
	for i, r := range rows {
		entries[i] = r.Entry
		if !slices.Contains(projectIDs, r.ProjectID) {
			projectIDs = append(projectIDs, r.ProjectID)
		}
	}
	views, err := s.present(ctx, entries)
	if err != nil {
		return Sheet{}, err
	}
	refs := map[uuid.UUID]projectsdomain.Ref{}
	if len(projectIDs) > 0 {
		if refs, err = s.projects.Refs(ctx, projectIDs); err != nil {
			return Sheet{}, err
		}
	}
	out := Sheet{Entries: make([]SheetEntry, len(rows))}
	for i, r := range rows {
		out.Entries[i] = SheetEntry{View: views[i], ProjectID: r.ProjectID, Project: refs[r.ProjectID], CardNumber: r.CardNumber, CardTitle: r.CardTitle}
		out.TotalSeconds += views[i].Elapsed
	}
	return out, nil
}

// UpdateInput changes a stopped entry.
type UpdateInput struct {
	Seconds   *int
	Note      *string
	StartedAt *time.Time
}

// Update edits a stopped entry: its author, or someone who manages time. Editing needs manual logging to be on,
// as it is the same act as logging by hand.
func (s *Service) Update(ctx context.Context, user, id uuid.UUID, in UpdateInput) (View, error) {
	e, err := s.repo.Get(ctx, id)
	if err != nil {
		return View{}, err
	}
	role, err := s.ws.Authorize(ctx, e.WorkspaceID, user, wsdomain.PermEditContent)
	if err != nil {
		return View{}, apperr.New(domain.ErrNotFound, "time entry not found")
	}
	if e.UserID != user && !role.Can(wsdomain.PermTimeManage) {
		return View{}, apperr.New(domain.ErrForbidden, "only the author or an admin can change a time entry")
	}
	if e.Running() {
		return View{}, apperr.New(domain.ErrRunning, "stop the timer before editing it")
	}
	policy, err := s.ws.Policy(ctx, e.WorkspaceID)
	if err != nil {
		return View{}, err
	}
	if !policy.TimeAllowManual {
		return View{}, apperr.New(wsdomain.ErrPolicy, "changing time by hand is switched off in this workspace")
	}
	seconds, note, start := e.Seconds, e.Note, e.StartedAt
	if in.Seconds != nil {
		seconds = *in.Seconds
	}
	if in.Note != nil {
		note = strings.TrimSpace(*in.Note)
	}
	if in.StartedAt != nil {
		start = *in.StartedAt
	}
	var v validation.V
	if seconds < domain.MinManualSeconds || seconds > domain.MaxManualSeconds {
		v.Add("seconds", validation.Range, map[string]any{"min": domain.MinManualSeconds, "max": domain.MaxManualSeconds})
	}
	v.Length("note", note, 0, domain.MaxNote)
	if start.Add(time.Duration(seconds) * time.Second).After(s.now().Add(time.Minute)) {
		v.Add("startedAt", validation.Range, map[string]any{"max": "now"})
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	upd, err := s.repo.UpdateEntry(ctx, id, seconds, note, start)
	if err != nil {
		return View{}, err
	}
	return s.one(ctx, upd)
}
