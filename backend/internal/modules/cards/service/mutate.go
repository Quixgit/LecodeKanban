package service

import (
	"context"
	"strings"

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

func validateFields(v *validation.V, title, description *string, priority *domain.Priority, progress *int) {
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
	if progress != nil && (*progress < 0 || *progress > 100) {
		v.Add("progress", validation.Range, map[string]any{"min": 0, "max": 100})
	}
}

func (s *Service) checkAssignees(ctx context.Context, ws uuid.UUID, ids []uuid.UUID, v *validation.V) ([]uuid.UUID, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return nil, err
	}
	seen := map[uuid.UUID]bool{}
	out := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if seen[id] {
			continue
		}
		seen[id] = true
		if _, ok := roles[id]; !ok {
			v.Add("assigneeIds", validation.NotMember, nil)
			return nil, nil
		}
		out = append(out, id)
	}
	if len(out) > 20 {
		v.Add("assigneeIds", validation.MaxLength, map[string]any{"max": 20})
	}
	return out, nil
}

// Create adds a card to a project (members and above).
func (s *Service) Create(ctx context.Context, user, ws uuid.UUID, in domain.NewCard) (View, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return View{}, err
	}
	if in.Priority == "" {
		in.Priority = domain.Medium
	}
	if in.Status == "" {
		in.Status = domain.Todo
	}
	var v validation.V
	validateFields(&v, &in.Title, &in.Description, &in.Priority, &in.Progress)
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
	assignees, err := s.checkAssignees(ctx, ws, in.AssigneeIDs, &v)
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
	progress := in.Progress
	if col.Category == boardsdomain.Done {
		progress = 100
	}
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		n, err := r.NextNumber(ctx, in.ProjectID)
		if err != nil {
			return err
		}
		last, err := r.LastPosition(ctx, col.ID)
		if err != nil {
			return err
		}
		pos, err := fractional.Between(last, "")
		if err != nil {
			return err
		}
		card, err = r.Insert(ctx, repository.Insert{
			WorkspaceID: ws, ProjectID: in.ProjectID, BoardID: col.BoardID, ColumnID: col.ID, Number: n,
			Title: in.Title, Description: in.Description, Status: domain.Status(col.Category), Priority: in.Priority,
			Progress: progress, DueDate: in.DueDate, Position: pos, CreatedBy: user,
		})
		if err != nil {
			return err
		}
		if err := r.SetAssignees(ctx, card.ID, assignees); err != nil {
			return err
		}
		return r.Transition(ctx, card, nil, user)
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardCreated{CardID: card.ID, ProjectID: card.ProjectID, WorkspaceID: ws, ActorID: user})
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
	validateFields(&v, p.Title, p.Description, p.Priority, p.Progress)
	var assignees []uuid.UUID
	if p.AssigneeIDs != nil {
		if assignees, err = s.checkAssignees(ctx, cur.WorkspaceID, *p.AssigneeIDs, &v); err != nil {
			return View{}, err
		}
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		var err error
		if card, err = r.Update(ctx, id, p); err != nil {
			return err
		}
		if p.AssigneeIDs != nil {
			return r.SetAssignees(ctx, id, assignees)
		}
		return nil
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardUpdated{CardID: id, ProjectID: card.ProjectID, WorkspaceID: card.WorkspaceID, ActorID: user})
	return s.presentOne(ctx, card)
}

// Move places a card in a column between optional neighbours (writes only this card).
func (s *Service) Move(ctx context.Context, user, id uuid.UUID, m domain.Move) (View, error) {
	cur, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	if m.Status != nil && !m.Status.Valid() {
		var v validation.V
		v.OneOf("status", string(*m.Status), "todo", "in_progress", "in_review", "done")
		return View{}, v.Err()
	}
	if m.ColumnID == nil && m.Status == nil {
		m.ColumnID = &cur.ColumnID
	}
	col, err := s.targetColumn(ctx, cur.ProjectID, m.ColumnID, m.Status)
	if err != nil {
		return View{}, err
	}
	invalid := apperr.New(domain.ErrInvalidMove, "neighbour cards are not adjacent in the target column")
	var card domain.Card
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		pos, err := s.position(ctx, r, col.ID, id, m.AfterID, m.BeforeID)
		if err != nil {
			return err
		}
		if pos == "" {
			return invalid
		}
		card, err = r.Move(ctx, repository.MoveTo{ID: id, ColumnID: col.ID, BoardID: col.BoardID,
			Status: domain.Status(col.Category), Position: pos, Version: m.Version})
		if err != nil {
			return err
		}
		if card.Status != cur.Status {
			from := cur.Status
			return r.Transition(ctx, card, &from, user)
		}
		return nil
	})
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.CardMoved{CardID: id, ProjectID: card.ProjectID, WorkspaceID: card.WorkspaceID,
		ActorID: user, From: string(cur.Status), To: string(card.Status)})
	return s.presentOne(ctx, card)
}

// position computes a fractional key between the neighbours (or at the end). Returns "" when
// neighbours are not in the column or out of order.
func (s *Service) position(ctx context.Context, r *repository.Repo, column, self uuid.UUID, after, before *uuid.UUID) (string, error) {
	lookup := func(id *uuid.UUID) (string, bool, error) {
		if id == nil || *id == self {
			return "", false, nil
		}
		p, ok, err := r.PositionIn(ctx, *id, column)
		return p, ok, err
	}
	a, hasA, err := lookup(after)
	if err != nil {
		return "", err
	}
	b, hasB, err := lookup(before)
	if err != nil {
		return "", err
	}
	if (after != nil && *after != self && !hasA) || (before != nil && *before != self && !hasB) {
		return "", nil
	}
	switch {
	case hasA && !hasB:
		if b, err = r.NextAfter(ctx, column, a); err != nil {
			return "", err
		}
	case hasB && !hasA:
		if a, err = r.PrevBefore(ctx, column, b); err != nil {
			return "", err
		}
	case !hasA && !hasB:
		if a, err = r.LastPosition(ctx, column); err != nil {
			return "", err
		}
	}
	key, err := fractional.Between(a, b)
	if err != nil {
		return "", nil
	}
	return key, nil
}

// Delete archives a card.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	c, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return err
	}
	if _, err := s.repo.Archive(ctx, id); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.CardDeleted{CardID: id, ProjectID: c.ProjectID, WorkspaceID: c.WorkspaceID, ActorID: user})
	return nil
}

type BulkAction struct {
	IDs      []uuid.UUID
	Action   string // move | priority | delete
	Status   *domain.Status
	Priority *domain.Priority
}

// Bulk applies one action to many cards of a workspace (last write wins, no version check).
func (s *Service) Bulk(ctx context.Context, user, ws uuid.UUID, a BulkAction) (int, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermEditContent); err != nil {
		return 0, err
	}
	var v validation.V
	v.OneOf("action", a.Action, "move", "priority", "delete")
	if len(a.IDs) == 0 || len(a.IDs) > 500 {
		v.Add("ids", validation.Count, map[string]any{"min": 1, "max": 500})
	}
	if a.Action == "move" && (a.Status == nil || !a.Status.Valid()) {
		v.Add("status", validation.Required, nil)
	}
	if a.Action == "priority" && (a.Priority == nil || !a.Priority.Valid()) {
		v.Add("priority", validation.Required, nil)
	}
	if err := v.Err(); err != nil {
		return 0, err
	}
	cards, err := s.repo.InWorkspace(ctx, ws, a.IDs)
	if err != nil {
		return 0, err
	}
	changed := 0
	for _, c := range cards {
		switch a.Action {
		case "delete":
			if ok, err := s.repo.Archive(ctx, c.ID); err != nil {
				return changed, err
			} else if ok {
				_ = s.bus.Publish(ctx, events.CardDeleted{CardID: c.ID, ProjectID: c.ProjectID, WorkspaceID: ws, ActorID: user})
				changed++
			}
		case "priority":
			if c.Priority == *a.Priority {
				continue
			}
			if _, err := s.repo.Update(ctx, c.ID, domain.Patch{Version: c.Version, Priority: a.Priority}); err != nil {
				return changed, err
			}
			_ = s.bus.Publish(ctx, events.CardUpdated{CardID: c.ID, ProjectID: c.ProjectID, WorkspaceID: ws, ActorID: user})
			changed++
		case "move":
			if c.Status == *a.Status {
				continue
			}
			if _, err := s.Move(ctx, user, c.ID, domain.Move{Version: c.Version, Status: a.Status}); err != nil {
				return changed, err
			}
			changed++
		}
	}
	return changed, nil
}
