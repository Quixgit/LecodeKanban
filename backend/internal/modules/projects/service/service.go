// Package service implements project use cases.
package service

import (
	"context"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Workspaces is the RBAC + membership port.
type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Role, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
}

// Boards provisions a project's default board.
type Boards interface {
	EnsureDefault(ctx context.Context, ws, project uuid.UUID, name, locale string) error
}

// Users resolves people for PIC display.
type Users interface {
	Get(ctx context.Context, id uuid.UUID) (usersdomain.User, error)
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

// CardCounter reports card totals per project (cards module).
type CardCounter interface {
	CountByProject(ctx context.Context, project uuid.UUID) (total, done int, err error)
}

type Service struct {
	repo   *repository.Repo
	ws     Workspaces
	boards Boards
	users  Users
	cards  CardCounter
	bus    *eventbus.Bus
	now    func() time.Time
}

func New(repo *repository.Repo, ws Workspaces, boards Boards, users Users, bus *eventbus.Bus) *Service {
	return &Service{repo: repo, ws: ws, boards: boards, users: users, bus: bus, now: time.Now}
}

// SetCardCounter wires the cards module after construction (cards depends on projects too).
func (s *Service) SetCardCounter(c CardCounter) { s.cards = c }

// Today is the date used for overdue/deadline maths (UTC; per-user zones come with settings).
func (s *Service) Today() time.Time {
	y, m, d := s.now().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// View is a project with presentation data resolved.
type View struct {
	domain.Project
	PIC     *usersdomain.User
	PICRole *wsdomain.Role
	Overdue bool
}

func (s *Service) present(ctx context.Context, ws uuid.UUID, list []domain.Project) ([]View, error) {
	ids := []uuid.UUID{}
	for _, p := range list {
		if p.PICID != nil && !slices.Contains(ids, *p.PICID) {
			ids = append(ids, *p.PICID)
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	roles := map[uuid.UUID]wsdomain.Role{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
		if roles, err = s.ws.RolesByUser(ctx, ws); err != nil {
			return nil, err
		}
	}
	today := s.Today()
	out := make([]View, len(list))
	for i, p := range list {
		v := View{Project: p, Overdue: p.Overdue(today)}
		if p.PICID != nil {
			if u, ok := people[*p.PICID]; ok {
				v.PIC = &u
			}
			if r, ok := roles[*p.PICID]; ok {
				v.PICRole = &r
			}
		}
		out[i] = v
	}
	return out, nil
}

func (s *Service) presentOne(ctx context.Context, p domain.Project) (View, error) {
	v, err := s.present(ctx, p.WorkspaceID, []domain.Project{p})
	if err != nil {
		return View{}, err
	}
	return v[0], nil
}

var keyRE = regexp.MustCompile(`^[A-Z][A-Z0-9]{1,5}$`)

// DeriveKey builds a 2–4 letter key from the name's Latin initials ("Kanban Core" → "KC").
func DeriveKey(name string) string {
	var initials, letters []rune
	for _, w := range strings.Fields(name) {
		for _, r := range w {
			if r < unicode.MaxASCII && unicode.IsLetter(r) {
				initials = append(initials, unicode.ToUpper(r))
				break
			}
		}
		for _, r := range w {
			if r < unicode.MaxASCII && (unicode.IsLetter(r) || unicode.IsDigit(r)) {
				letters = append(letters, unicode.ToUpper(r))
			}
		}
	}
	key := string(initials)
	if len(key) < 2 {
		key = string(letters)
	}
	if len(key) > 4 {
		key = key[:4]
	}
	if len(key) < 2 || !unicode.IsLetter(rune(key[0])) {
		return "PRJ"
	}
	return key
}

type validated struct {
	name, description, icon, tone string
	team                          *string
}

func (s *Service) validateCommon(v *validation.V, name, description, icon, tone *string, team *string, start, deadline *time.Time) validated {
	out := validated{}
	if name != nil {
		out.name = strings.TrimSpace(*name)
		if v.Required("name", out.name) {
			v.Length("name", out.name, 1, 120)
		}
	}
	if description != nil {
		out.description = strings.TrimSpace(*description)
		v.Length("description", out.description, 0, 5000)
	}
	if icon != nil {
		out.icon = *icon
		v.OneOf("icon", *icon, domain.Icons...)
	}
	if tone != nil {
		out.tone = *tone
		v.OneOf("tone", *tone, domain.Tones...)
	}
	if team != nil {
		t := strings.TrimSpace(*team)
		if t != "" {
			v.Length("team", t, 1, 60)
			out.team = &t
		}
	}
	if start != nil && deadline != nil && deadline.Before(*start) {
		v.Add("deadline", validation.DateOrder, nil)
	}
	return out
}

func (s *Service) checkPIC(ctx context.Context, ws uuid.UUID, pic *uuid.UUID, v *validation.V) error {
	if pic == nil {
		return nil
	}
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return err
	}
	if _, ok := roles[*pic]; !ok {
		v.Add("picId", validation.NotMember, nil)
	}
	return nil
}

type CreateInput struct {
	Key, Name, Description, Icon, Tone string
	Status                             domain.Status
	PICID                              *uuid.UUID
	Team                               *string
	StartDate, Deadline                *time.Time
}

// Create adds a project (members and above) and provisions its default board.
func (s *Service) Create(ctx context.Context, user, ws uuid.UUID, in CreateInput, locale string) (View, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return View{}, err
	}
	if in.Icon == "" {
		in.Icon = "folder"
	}
	if in.Tone == "" {
		in.Tone = "teal"
	}
	if in.Status == "" {
		in.Status = domain.StatusPending
	}
	var v validation.V
	c := s.validateCommon(&v, &in.Name, &in.Description, &in.Icon, &in.Tone, in.Team, in.StartDate, in.Deadline)
	if !in.Status.Valid() {
		v.OneOf("status", string(in.Status), "pending", "in_progress", "completed")
	}
	key := strings.ToUpper(strings.TrimSpace(in.Key))
	explicitKey := key != ""
	if explicitKey && !keyRE.MatchString(key) {
		v.Add("key", validation.KeyFormat, nil)
	}
	if err := s.checkPIC(ctx, ws, in.PICID, &v); err != nil {
		return View{}, err
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	if !explicitKey {
		key = DeriveKey(c.name)
	}

	var p domain.Project
	var err error
	for attempt := 0; attempt < 20; attempt++ {
		candidate := key
		if attempt > 0 {
			suffix := strconv.Itoa(attempt + 1)
			candidate = key[:min(len(key), 6-len(suffix))] + suffix
		}
		p, err = s.repo.Create(ctx, ws, user, domain.NewProject{
			Key: candidate, Name: c.name, Description: c.description, Status: in.Status, PICID: in.PICID,
			Team: c.team, Icon: c.icon, Tone: c.tone, StartDate: in.StartDate, Deadline: in.Deadline,
		})
		if !repository.KeyTaken(err) {
			break
		}
		if explicitKey {
			return View{}, apperr.New(domain.ErrKeyTaken, "project key already used")
		}
	}
	if err != nil {
		return View{}, err
	}
	if err := s.boards.EnsureDefault(ctx, ws, p.ID, p.Name, locale); err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.ProjectCreated{ProjectID: p.ID, WorkspaceID: ws})
	return s.presentOne(ctx, p)
}

// load returns the project after checking the caller holds perm in its workspace.
func (s *Service) load(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Project, error) {
	p, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Project{}, err
	}
	if _, err := s.ws.Authorize(ctx, p.WorkspaceID, user, perm); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Project{}, apperr.New(domain.ErrNotFound, "project not found")
		}
		return domain.Project{}, err
	}
	return p, nil
}

func (s *Service) Get(ctx context.Context, user, id uuid.UUID) (View, error) {
	p, err := s.load(ctx, user, id, wsdomain.PermView)
	if err != nil {
		return View{}, err
	}
	return s.presentOne(ctx, p)
}

func (s *Service) Update(ctx context.Context, user, id uuid.UUID, patch domain.Patch) (View, error) {
	cur, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	var v validation.V
	start, deadline := cur.StartDate, cur.Deadline
	if patch.SetStart {
		start = patch.StartDate
	}
	if patch.SetDeadline {
		deadline = patch.Deadline
	}
	var team *string
	if patch.SetTeam {
		team = patch.Team
	}
	c := s.validateCommon(&v, patch.Name, patch.Description, patch.Icon, patch.Tone, team, start, deadline)
	if patch.Name != nil {
		patch.Name = &c.name
	}
	if patch.Description != nil {
		patch.Description = &c.description
	}
	if patch.SetTeam {
		patch.Team = c.team
	}
	if patch.Status != nil && !patch.Status.Valid() {
		v.OneOf("status", string(*patch.Status), "pending", "in_progress", "completed")
	}
	if patch.SetPIC {
		if err := s.checkPIC(ctx, cur.WorkspaceID, patch.PICID, &v); err != nil {
			return View{}, err
		}
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	p, err := s.repo.Update(ctx, id, patch)
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.ProjectUpdated{ProjectID: p.ID, WorkspaceID: p.WorkspaceID})
	return s.presentOne(ctx, p)
}

// Archive hides a project and its cards (admins and above).
func (s *Service) Archive(ctx context.Context, user, id uuid.UUID) error {
	p, err := s.load(ctx, user, id, wsdomain.PermUpdate)
	if err != nil {
		return err
	}
	if err := s.repo.Archive(ctx, id); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.ProjectArchived{ProjectID: id, WorkspaceID: p.WorkspaceID})
	return nil
}

func (s *Service) List(ctx context.Context, user, ws uuid.UUID, f domain.Filter, pg pagination.Params) ([]View, int, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, 0, err
	}
	list, total, err := s.repo.List(ctx, ws, f, s.Today(), pg)
	if err != nil {
		return nil, 0, err
	}
	views, err := s.present(ctx, ws, list)
	return views, total, err
}

func (s *Service) Summary(ctx context.Context, user, ws uuid.UUID) (domain.Summary, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return domain.Summary{}, err
	}
	return s.repo.Summary(ctx, ws, s.Today())
}

// Recount refreshes the denormalised card counters (called on card events).
func (s *Service) Recount(ctx context.Context, project uuid.UUID) error {
	if s.cards == nil {
		return nil
	}
	total, done, err := s.cards.CountByProject(ctx, project)
	if err != nil {
		return err
	}
	return s.repo.SetCounts(ctx, project, total, done)
}

// Refs returns minimal project data for other modules (no authorisation).
func (s *Service) Refs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.Ref, error) {
	if len(ids) == 0 {
		return map[uuid.UUID]domain.Ref{}, nil
	}
	return s.repo.Refs(ctx, ids)
}

// Ref returns one project's reference data, or projects.not_found (including archived).
func (s *Service) Ref(ctx context.Context, id uuid.UUID) (domain.Ref, error) {
	p, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Ref{}, err
	}
	return domain.Ref{ID: p.ID, WorkspaceID: p.WorkspaceID, Key: p.Key, Name: p.Name, Icon: p.Icon, Tone: p.Tone}, nil
}
