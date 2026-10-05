// Package service implements task templates and recurring tasks. A template is only a starting point: tasks are
// made through the cards module, so every workspace rule and permission applies exactly as for a hand-made task.
package service

import (
	"context"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type Cards interface {
	Create(ctx context.Context, user, ws uuid.UUID, in carddomain.NewCard) (cardsvc.View, error)
	AddChecklistItem(ctx context.Context, user, card uuid.UUID, text string) (carddomain.ChecklistItem, error)
	Labels(ctx context.Context, user, ws uuid.UUID) ([]carddomain.Label, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
}

type Projects interface {
	Ref(ctx context.Context, id uuid.UUID) (projectsdomain.Ref, error)
}

type Service struct {
	repo     *repository.Repo
	cards    Cards
	ws       Workspaces
	projects Projects
	log      *slog.Logger
	now      func() time.Time
}

func New(repo *repository.Repo, cards Cards, ws Workspaces, projects Projects, log *slog.Logger) *Service {
	return &Service{repo: repo, cards: cards, ws: ws, projects: projects, log: log, now: time.Now}
}

// TemplateInput is what a person fills in.
type TemplateInput struct {
	Name, Title, Description, Priority string
	LabelIDs, AssigneeIDs              []uuid.UUID
	Checklist, Subtasks                []string
	DueInDays                          *int
}

// cleanList trims entries and drops empty ones.
func cleanList(in []string) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func (in *TemplateInput) validate() error {
	var v validation.V
	in.Name, in.Title = strings.TrimSpace(in.Name), strings.TrimSpace(in.Title)
	if v.Required("name", in.Name) {
		v.Length("name", in.Name, 1, 80)
	}
	if v.Required("title", in.Title) {
		v.Length("title", in.Title, 1, 300)
	}
	v.Length("description", in.Description, 0, 50000)
	if in.Priority == "" {
		in.Priority = "medium"
	}
	v.OneOf("priority", in.Priority, "high", "medium", "low")
	in.Checklist, in.Subtasks = cleanList(in.Checklist), cleanList(in.Subtasks)
	for field, list := range map[string][]string{"checklist": in.Checklist, "subtasks": in.Subtasks} {
		max := domain.MaxChecklistItems
		if field == "subtasks" {
			max = domain.MaxSubtasks
		}
		if len(list) > max {
			v.Add(field, validation.Count, map[string]any{"min": 0, "max": max})
		}
		for _, s := range list {
			if len([]rune(s)) > domain.MaxItemLength {
				v.Add(field, validation.MaxLength, map[string]any{"max": domain.MaxItemLength})
				break
			}
		}
	}
	in.LabelIDs, in.AssigneeIDs = dedupe(in.LabelIDs), dedupe(in.AssigneeIDs)
	if len(in.LabelIDs) > domain.MaxLabelsPerTask {
		v.Add("labelIds", validation.Count, map[string]any{"min": 0, "max": domain.MaxLabelsPerTask})
	}
	if len(in.AssigneeIDs) > domain.MaxAssigneesInTask {
		v.Add("assigneeIds", validation.Count, map[string]any{"min": 0, "max": domain.MaxAssigneesInTask})
	}
	if in.DueInDays != nil && (*in.DueInDays < 0 || *in.DueInDays > 365) {
		v.Add("dueInDays", validation.Range, map[string]any{"min": 0, "max": 365})
	}
	return v.Err()
}

func dedupe(ids []uuid.UUID) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}

func (in TemplateInput) toDomain(ws uuid.UUID) domain.Template {
	return domain.Template{WorkspaceID: ws, Name: in.Name, Title: in.Title, Description: in.Description, Priority: in.Priority,
		LabelIDs: in.LabelIDs, AssigneeIDs: in.AssigneeIDs, Checklist: in.Checklist, Subtasks: in.Subtasks, DueInDays: in.DueInDays}
}

func (s *Service) Templates(ctx context.Context, user, ws uuid.UUID) ([]domain.Template, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Templates(ctx, ws)
}

// loadTemplate finds a template and checks the person's right to it in its workspace.
func (s *Service) loadTemplate(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Template, error) {
	t, err := s.repo.Template(ctx, id)
	if err != nil {
		return domain.Template{}, err
	}
	if _, err := s.ws.Authorize(ctx, t.WorkspaceID, user, perm); err != nil {
		// Someone outside the workspace must not learn that the template exists.
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Template{}, apperr.New(domain.ErrNotFound, "template not found")
		}
		return domain.Template{}, err
	}
	return t, nil
}

func (s *Service) CreateTemplate(ctx context.Context, user, ws uuid.UUID, in TemplateInput) (domain.Template, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return domain.Template{}, err
	}
	if err := in.validate(); err != nil {
		return domain.Template{}, err
	}
	n, err := s.repo.CountTemplates(ctx, ws)
	if err != nil {
		return domain.Template{}, err
	}
	if n >= domain.MaxTemplates {
		return domain.Template{}, apperr.New(domain.ErrTooMany, "too many templates").WithMeta("max", domain.MaxTemplates)
	}
	t := in.toDomain(ws)
	t.CreatedBy = &user
	return s.repo.CreateTemplate(ctx, t)
}

func (s *Service) UpdateTemplate(ctx context.Context, user, id uuid.UUID, in TemplateInput) (domain.Template, error) {
	cur, err := s.loadTemplate(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return domain.Template{}, err
	}
	if err := in.validate(); err != nil {
		return domain.Template{}, err
	}
	t := in.toDomain(cur.WorkspaceID)
	t.ID = id
	return s.repo.UpdateTemplate(ctx, t)
}

func (s *Service) DeleteTemplate(ctx context.Context, user, id uuid.UUID) error {
	if _, err := s.loadTemplate(ctx, user, id, wsdomain.PermEditContent); err != nil {
		return err
	}
	return s.repo.DeleteTemplate(ctx, id)
}

// UseInput says where the task goes and what the person overrides.
type UseInput struct {
	ProjectID uuid.UUID
	ColumnID  *uuid.UUID
	Title     *string
	DueDate   *time.Time
}

// Use makes a task from the template: its fields, then its checklist and subtasks. People and labels that no
// longer exist (or have left the workspace) are left out instead of failing the whole task.
func (s *Service) Use(ctx context.Context, user, id uuid.UUID, in UseInput) (cardsvc.View, error) {
	t, err := s.loadTemplate(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return cardsvc.View{}, err
	}
	return s.instantiate(ctx, user, t, in)
}

func (s *Service) instantiate(ctx context.Context, user uuid.UUID, t domain.Template, in UseInput) (cardsvc.View, error) {
	labels, err := s.cards.Labels(ctx, user, t.WorkspaceID)
	if err != nil {
		return cardsvc.View{}, err
	}
	roles, err := s.ws.RolesByUser(ctx, t.WorkspaceID)
	if err != nil {
		return cardsvc.View{}, err
	}
	nc := carddomain.NewCard{ProjectID: in.ProjectID, ColumnID: in.ColumnID, Title: t.Title, Description: t.Description,
		Priority: carddomain.Priority(t.Priority)}
	if in.Title != nil && strings.TrimSpace(*in.Title) != "" {
		nc.Title = *in.Title
	}
	for _, id := range t.LabelIDs {
		if slices.ContainsFunc(labels, func(l carddomain.Label) bool { return l.ID == id }) {
			nc.LabelIDs = append(nc.LabelIDs, id)
		}
	}
	for _, id := range t.AssigneeIDs {
		if _, ok := roles[id]; ok {
			nc.AssigneeIDs = append(nc.AssigneeIDs, id)
		}
	}
	switch {
	case in.DueDate != nil:
		nc.DueDate = in.DueDate
	case t.DueInDays != nil:
		d := s.now().UTC().AddDate(0, 0, *t.DueInDays)
		d = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		nc.DueDate = &d
	}
	card, err := s.cards.Create(ctx, user, t.WorkspaceID, nc)
	if err != nil {
		return cardsvc.View{}, err
	}
	for _, text := range t.Checklist {
		if _, err := s.cards.AddChecklistItem(ctx, user, card.ID, text); err != nil {
			return card, err
		}
	}
	for _, title := range t.Subtasks {
		sub := carddomain.NewCard{ProjectID: in.ProjectID, Title: title, ParentID: &card.ID, Priority: nc.Priority}
		if _, err := s.cards.Create(ctx, user, t.WorkspaceID, sub); err != nil {
			return card, err
		}
	}
	return card, nil
}

// RecurrenceInput is what a person fills in for a schedule.
type RecurrenceInput struct {
	TemplateID, ProjectID uuid.UUID
	Freq                  domain.Freq
	Weekdays              []int
	MonthDay, Hour        int
	Timezone              string
	Active                bool
}

func (s *Service) build(ctx context.Context, ws uuid.UUID, in RecurrenceInput) (domain.Recurrence, error) {
	var v validation.V
	x := domain.Recurrence{WorkspaceID: ws, TemplateID: in.TemplateID, ProjectID: in.ProjectID, Freq: in.Freq,
		MonthDay: in.MonthDay, Hour: in.Hour, Timezone: in.Timezone, Active: in.Active}
	if x.Timezone == "" {
		x.Timezone = "UTC"
	}
	if !x.Freq.Valid() {
		v.OneOf("freq", string(x.Freq), "daily", "weekly", "monthly")
	}
	for _, d := range in.Weekdays {
		if d < 1 || d > 7 {
			v.Add("weekdays", validation.Range, map[string]any{"min": 1, "max": 7})
			break
		}
		if !slices.Contains(x.Weekdays, d) {
			x.Weekdays = append(x.Weekdays, d)
		}
	}
	slices.Sort(x.Weekdays)
	if x.Freq == domain.Weekly && len(x.Weekdays) == 0 {
		v.Add("weekdays", validation.Required, nil)
	}
	if x.Freq == domain.Monthly && (x.MonthDay < 1 || x.MonthDay > 31) {
		v.Add("monthDay", validation.Range, map[string]any{"min": 1, "max": 31})
	}
	if x.Hour < 0 || x.Hour > 23 {
		v.Add("hour", validation.Range, map[string]any{"min": 0, "max": 23})
	}
	if _, err := time.LoadLocation(x.Timezone); err != nil {
		v.Add("timezone", validation.OneOf, nil)
	}
	tpl, err := s.repo.Template(ctx, in.TemplateID)
	if err != nil && !apperr.IsCode(err, domain.ErrNotFound) {
		return x, err
	}
	if err != nil || tpl.WorkspaceID != ws {
		v.Add("templateId", validation.NotFound, nil)
	}
	project, err := s.projects.Ref(ctx, in.ProjectID)
	if err != nil && !apperr.IsCode(err, projectsdomain.ErrNotFound) {
		return x, err
	}
	if err != nil || project.WorkspaceID != ws {
		v.Add("projectId", validation.NotFound, nil)
	}
	if err := v.Err(); err != nil {
		return x, err
	}
	x.NextRunAt = x.Next(s.now())
	return x, nil
}

func (s *Service) Recurring(ctx context.Context, user, ws uuid.UUID) ([]domain.Recurrence, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Recurring(ctx, ws)
}

func (s *Service) CreateRecurring(ctx context.Context, user, ws uuid.UUID, in RecurrenceInput) (domain.Recurrence, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return domain.Recurrence{}, err
	}
	x, err := s.build(ctx, ws, in)
	if err != nil {
		return domain.Recurrence{}, err
	}
	n, err := s.repo.CountRecurring(ctx, ws)
	if err != nil {
		return domain.Recurrence{}, err
	}
	if n >= domain.MaxRecurring {
		return domain.Recurrence{}, apperr.New(domain.ErrTooMany, "too many recurring tasks").WithMeta("max", domain.MaxRecurring)
	}
	x.CreatedBy = user
	return s.repo.CreateRecurring(ctx, x)
}

func (s *Service) loadRecurring(ctx context.Context, user, id uuid.UUID) (domain.Recurrence, error) {
	x, err := s.repo.RecurringByID(ctx, id)
	if err != nil {
		return domain.Recurrence{}, err
	}
	if _, err := s.ws.Authorize(ctx, x.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Recurrence{}, apperr.New(domain.ErrRecurringMissing, "recurring task not found")
		}
		return domain.Recurrence{}, err
	}
	return x, nil
}

// UpdateRecurring replaces a schedule. The tasks it makes are created in the name of the person who saved it last.
func (s *Service) UpdateRecurring(ctx context.Context, user, id uuid.UUID, in RecurrenceInput) (domain.Recurrence, error) {
	cur, err := s.loadRecurring(ctx, user, id)
	if err != nil {
		return domain.Recurrence{}, err
	}
	x, err := s.build(ctx, cur.WorkspaceID, in)
	if err != nil {
		return domain.Recurrence{}, err
	}
	x.ID = id
	return s.repo.UpdateRecurring(ctx, x)
}

func (s *Service) DeleteRecurring(ctx context.Context, user, id uuid.UUID) error {
	if _, err := s.loadRecurring(ctx, user, id); err != nil {
		return err
	}
	return s.repo.DeleteRecurring(ctx, id)
}

// Tick creates the tasks of every schedule that is due. Several instances may run it: claims are atomic.
func (s *Service) Tick(ctx context.Context) {
	due, err := s.repo.ClaimDue(ctx, s.now(), 50)
	if err != nil {
		s.log.Warn("recurring tasks: claim failed", slog.Any("err", err))
		return
	}
	for _, x := range due {
		s.run(ctx, x)
	}
}

func (s *Service) run(ctx context.Context, x domain.Recurrence) {
	tpl, err := s.repo.Template(ctx, x.TemplateID)
	if err == nil {
		var card cardsvc.View
		card, err = s.instantiate(ctx, x.CreatedBy, tpl, UseInput{ProjectID: x.ProjectID})
		if card.ID != uuid.Nil {
			id := card.ID
			_ = s.repo.RecordRun(ctx, x.ID, &id, "")
		}
	}
	if err == nil {
		return
	}
	code := "error"
	if ae := apperr.From(err); ae != nil {
		code = string(ae.Code)
		// The person lost access or the project is gone: running again would only repeat the refusal.
		if ae.Status() == 403 || ae.Status() == 404 {
			_ = s.repo.Deactivate(ctx, x.ID, code)
			s.log.Warn("recurring task switched off", slog.String("id", x.ID.String()), slog.String("reason", code))
			return
		}
	}
	_ = s.repo.RecordRun(ctx, x.ID, nil, code)
	s.log.Warn("recurring task failed", slog.String("id", x.ID.String()), slog.Any("err", err))
}

// Run ticks until ctx ends.
func (s *Service) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Tick(ctx)
		}
	}
}
