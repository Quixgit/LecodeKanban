package service

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	boardsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

const maxLabelsPerCard = 10

func validateFields(v *validation.V, title, description *string, priority *domain.Priority) {
	if title != nil {
		*title = strings.TrimSpace(*title)
		if v.Required("title", *title) {
			v.Length("title", *title, 1, 300)
		}
	}
	if description != nil {
		v.Length("description", *description, 0, 50000)
	}
	if priority != nil && !priority.Valid() {
		v.OneOf("priority", string(*priority), "high", "medium", "low")
	}
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

func (s *Service) checkAssignees(ctx context.Context, ws uuid.UUID, ids []uuid.UUID, v *validation.V) ([]uuid.UUID, error) {
	ids = dedupe(ids)
	if len(ids) == 0 {
		return ids, nil
	}
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return nil, err
	}
	for _, id := range ids {
		if _, ok := roles[id]; !ok {
			v.Add("assigneeIds", validation.NotMember, nil)
			return nil, nil
		}
	}
	if len(ids) > 20 {
		v.Add("assigneeIds", validation.MaxLength, map[string]any{"max": 20})
	}
	return ids, nil
}

func (s *Service) checkLabels(ctx context.Context, ws uuid.UUID, ids []uuid.UUID, v *validation.V) ([]uuid.UUID, error) {
	ids = dedupe(ids)
	if len(ids) == 0 {
		return ids, nil
	}
	if len(ids) > maxLabelsPerCard {
		v.Add("labelIds", validation.MaxLength, map[string]any{"max": maxLabelsPerCard})
		return nil, nil
	}
	ok, err := s.repo.AllLabelsIn(ctx, ws, ids)
	if err != nil {
		return nil, err
	}
	if !ok {
		v.Add("labelIds", validation.NotFound, nil)
	}
	return ids, nil
}

// Create adds a card to a project (members and above).
func (s *Service) Create(ctx context.Context, user, ws uuid.UUID, in domain.NewCard) (View, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return View{}, err
	}
	policy, err := s.ws.Policy(ctx, ws)
	if err != nil {
		return View{}, err
	}
	if in.Priority == "" {
		in.Priority = domain.Priority(policy.DefaultPriority)
		if !in.Priority.Valid() {
			in.Priority = domain.Medium
		}
	}
	if in.Status == "" {
		in.Status = domain.Todo
	}
	var v validation.V
	if policy.RequireDueDate && in.DueDate == nil {
		v.Add("dueDate", validation.Required, nil)
	}
	validateFields(&v, &in.Title, &in.Description, &in.Priority)
	if !in.Status.Valid() {
		v.OneOf("status", string(in.Status), "todo", "in_progress", "in_review", "done")
	}
	project, err := s.projects.Ref(ctx, in.ProjectID)
	if err != nil && !apperr.IsCode(err, projectsdomain.ErrNotFound) {
		return View{}, err
	}
	if err != nil || project.WorkspaceID != ws {
		v.Add("projectId", validation.NotFound, nil)
	}
	if in.ParentID != nil {
		parent, err := s.repo.Get(ctx, *in.ParentID)
		switch {
		case err != nil && !apperr.IsCode(err, domain.ErrNotFound):
			return View{}, err
		case err != nil || parent.WorkspaceID != ws || parent.ProjectID != in.ProjectID:
			v.Add("parentId", validation.NotFound, nil)
		case parent.ParentID != nil:
			v.Add("parentId", validation.NotFound, nil) // subtasks are one level deep: a subtask cannot be a parent
		}
	}
	assignees, err := s.checkAssignees(ctx, ws, in.AssigneeIDs, &v)
	if err != nil {
		return View{}, err
	}
	labels, err := s.checkLabels(ctx, ws, in.LabelIDs, &v)
	if err != nil {
		return View{}, err
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}

	col, err := s.targetColumn(ctx, in.ProjectID, in.ColumnID, &in.Status)
	if err != nil {
		return View{}, err
	}
	status := domain.Status(col.Category)
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		n, err := r.NextNumber(ctx, in.ProjectID)
		if err != nil {
			return err
		}
		// End of the whole status lane, which is also the end of the column: keys stay unique
		// across projects, so the cross-project board orders cards unambiguously.
		last, err := r.LastInStatus(ctx, ws, status)
		if err != nil {
			return err
		}
		pos, err := fractional.BetweenUnique(last, "")
		if err != nil {
			return err
		}
		card, err = r.Insert(ctx, repository.Insert{
			WorkspaceID: ws, ProjectID: in.ProjectID, BoardID: col.BoardID, ColumnID: col.ID, Number: n,
			Title: in.Title, Description: in.Description, Status: status, Priority: in.Priority,
			Progress: domain.DeriveProgress(status, 0, 0), DueDate: in.DueDate, Position: pos, CreatedBy: user,
			ParentID: in.ParentID,
		})
		if err != nil {
			return err
		}
		if in.ParentID != nil {
			if _, err := r.RefreshSubtasks(ctx, *in.ParentID); err != nil {
				return err
			}
		}
		if err := r.SetAssignees(ctx, card.ID, assignees); err != nil {
			return err
		}
		if err := r.SetLabels(ctx, card.ID, labels); err != nil {
			return err
		}
		return r.Transition(ctx, card, nil, user)
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardCreated{Card: evCard(card, user), Status: string(card.Status), Assignees: assignees})
	return s.presentOne(ctx, card)
}

// targetColumn resolves an explicit column (must belong to the project) or the first column of a status.
func (s *Service) targetColumn(ctx context.Context, project uuid.UUID, columnID *uuid.UUID, status *domain.Status) (boardsdomain.Column, error) {
	if columnID != nil {
		col, err := s.boards.Column(ctx, *columnID)
		if err != nil || col.ProjectID != project {
			return boardsdomain.Column{}, apperr.New(domain.ErrInvalidMove, "column does not belong to the card's project")
		}
		return col, nil
	}
	st := domain.Todo
	if status != nil {
		st = *status
	}
	return s.boards.FirstColumn(ctx, project, boardsdomain.Category(st))
}

// Update edits fields with optimistic concurrency (patch.Version must match).
func (s *Service) Update(ctx context.Context, user, id uuid.UUID, p domain.Patch) (View, error) {
	cur, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	var v validation.V
	validateFields(&v, p.Title, p.Description, p.Priority)
	var assignees, labels []uuid.UUID
	if p.AssigneeIDs != nil {
		if assignees, err = s.checkAssignees(ctx, cur.WorkspaceID, *p.AssigneeIDs, &v); err != nil {
			return View{}, err
		}
	}
	if p.LabelIDs != nil {
		if labels, err = s.checkLabels(ctx, cur.WorkspaceID, *p.LabelIDs, &v); err != nil {
			return View{}, err
		}
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	before, err := s.presentOne(ctx, cur)
	if err != nil {
		return View{}, err
	}
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if card, err = r.Update(ctx, id, p); err != nil {
			return err
		}
		if p.AssigneeIDs != nil {
			if err := r.SetAssignees(ctx, id, assignees); err != nil {
				return err
			}
		}
		if p.LabelIDs != nil {
			return r.SetLabels(ctx, id, labels)
		}
		return nil
	})
	if err != nil {
		return View{}, err
	}
	after, err := s.presentOne(ctx, card)
	if err != nil {
		return View{}, err
	}
	if changes := diff(before.Card, after.Card); len(changes) > 0 {
		_ = s.bus.Publish(ctx, events.CardUpdated{Card: evCard(card, user), Changes: changes})
	}
	return after, nil
}

func dateValue(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.Format(time.DateOnly)
}

// added / removed return the set difference of two id lists.
func added(from, to []uuid.UUID) []uuid.UUID {
	out := []uuid.UUID{}
	for _, id := range to {
		if !slices.Contains(from, id) {
			out = append(out, id)
		}
	}
	return out
}

// diff lists the user-visible changes between two versions of a card.
func diff(a, b domain.Card) []events.FieldChange {
	var out []events.FieldChange
	if a.Title != b.Title {
		out = append(out, events.FieldChange{Field: "title", From: a.Title, To: b.Title})
	}
	if a.Description != b.Description {
		out = append(out, events.FieldChange{Field: "description"})
	}
	if a.Priority != b.Priority {
		out = append(out, events.FieldChange{Field: "priority", From: string(a.Priority), To: string(b.Priority)})
	}
	if da, db := dateValue(a.DueDate), dateValue(b.DueDate); da != db {
		out = append(out, events.FieldChange{Field: "dueDate", From: da, To: db})
	}
	if add, rm := added(a.Assignees, b.Assignees), added(b.Assignees, a.Assignees); len(add)+len(rm) > 0 {
		out = append(out, events.FieldChange{Field: "assignees", From: rm, To: add})
	}
	if add, rm := added(a.Labels, b.Labels), added(b.Labels, a.Labels); len(add)+len(rm) > 0 {
		out = append(out, events.FieldChange{Field: "labels", From: rm, To: add})
	}
	return out
}

// Delete archives a card.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	c, err := s.load(ctx, user, id, wsdomain.PermTasksDelete)
	if err != nil {
		return err
	}
	if _, err := s.repo.Archive(ctx, id); err != nil {
		return err
	}
	if err := s.afterRemoved(ctx, c); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.CardDeleted{Card: evCard(c, user)})
	return nil
}

// afterRemoved keeps subtask bookkeeping in step: a deleted parent takes its subtasks along, a
// deleted subtask updates its parent's counters and progress.
func (s *Service) afterRemoved(ctx context.Context, c domain.Card) error {
	if err := s.repo.ArchiveChildren(ctx, c.ID); err != nil {
		return err
	}
	if c.ParentID != nil {
		_, err := s.repo.RefreshSubtasks(ctx, *c.ParentID)
		return err
	}
	return nil
}
