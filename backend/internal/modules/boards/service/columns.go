package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/fractional"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// NewColumn describes a custom column; it is placed after the last column of its status.
type NewColumn struct {
	Name     string
	Category domain.Category
	WIPLimit *int
}

func validateColumn(v *validation.V, name *string, wip *int) {
	if name != nil {
		*name = strings.TrimSpace(*name)
		if v.Required("name", *name) {
			v.Length("name", *name, 1, 60)
		}
	}
	if wip != nil && (*wip < 1 || *wip > domain.MaxWIPLimit) {
		v.Add("wipLimit", validation.Range, map[string]any{"min": 1, "max": domain.MaxWIPLimit})
	}
}

// loadColumn authorises content editing on the column's workspace (non-members get not_found).
func (s *Service) loadColumn(ctx context.Context, user, id uuid.UUID) (domain.Column, error) {
	col, err := s.repo.Column(ctx, id)
	if err != nil {
		return domain.Column{}, err
	}
	if _, err := s.auth.Authorize(ctx, col.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return domain.Column{}, apperr.New(domain.ErrColumnNotFound, "column not found")
		}
		return domain.Column{}, err
	}
	return col, nil
}

func (s *Service) columnsChanged(ctx context.Context, col domain.Column, user uuid.UUID, action string) {
	_ = s.bus.Publish(ctx, events.ColumnsChanged{WorkspaceID: col.WorkspaceID, ProjectID: col.ProjectID, ActorID: user,
		Action: action, Column: col.Name})
}

// CreateColumn adds a custom column to a project's board.
func (s *Service) CreateColumn(ctx context.Context, user, project uuid.UUID, in NewColumn) (domain.Column, error) {
	b, err := s.repo.BoardByProject(ctx, project)
	if err != nil {
		return domain.Column{}, err
	}
	if _, err := s.auth.Authorize(ctx, b.WorkspaceID, user, wsdomain.PermEditContent); err != nil {
		return domain.Column{}, err
	}
	var v validation.V
	validateColumn(&v, &in.Name, in.WIPLimit)
	if !in.Category.Valid() {
		v.OneOf("status", string(in.Category), "todo", "in_progress", "in_review", "done")
	}
	if err := v.Err(); err != nil {
		return domain.Column{}, err
	}
	var id uuid.UUID
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		total, _, err := r.CountColumns(ctx, b.ID, in.Category)
		if err != nil {
			return err
		}
		if total >= domain.MaxColumns {
			return apperr.New(domain.ErrTooManyColumns, "board has too many columns").WithMeta("max", domain.MaxColumns)
		}
		// Right after the status' last column (every status keeps at least one column).
		after, err := r.LastColumnInCategory(ctx, b.ID, in.Category)
		if err != nil {
			return err
		}
		before, err := r.NextColumnAfter(ctx, b.ID, after)
		if err != nil {
			return err
		}
		pos, err := fractional.Between(after, before)
		if err != nil {
			return err
		}
		id, err = r.AddColumn(ctx, b.ID, in.Name, in.Category, pos, in.WIPLimit)
		return err
	})
	if err != nil {
		return domain.Column{}, err
	}
	col, err := s.repo.Column(ctx, id)
	if err != nil {
		return domain.Column{}, err
	}
	s.columnsChanged(ctx, col, user, "created")
	return col, nil
}

// UpdateColumn renames a column and/or changes its WIP limit.
func (s *Service) UpdateColumn(ctx context.Context, user, id uuid.UUID, p repository.ColumnPatch) (domain.Column, error) {
	if _, err := s.loadColumn(ctx, user, id); err != nil {
		return domain.Column{}, err
	}
	var v validation.V
	validateColumn(&v, p.Name, p.WIP)
	if err := v.Err(); err != nil {
		return domain.Column{}, err
	}
	if _, err := s.repo.UpdateColumn(ctx, id, p); err != nil {
		return domain.Column{}, err
	}
	col, err := s.repo.Column(ctx, id)
	if err != nil {
		return domain.Column{}, err
	}
	s.columnsChanged(ctx, col, user, "updated")
	return col, nil
}

// MoveColumn reorders a column between neighbours of the same board.
func (s *Service) MoveColumn(ctx context.Context, user, id uuid.UUID, afterID, beforeID *uuid.UUID) (domain.Column, error) {
	col, err := s.loadColumn(ctx, user, id)
	if err != nil {
		return domain.Column{}, err
	}
	invalid := apperr.New(domain.ErrInvalidMove, "neighbour columns are not on this board")
	neighbour := func(nid *uuid.UUID) (string, error) {
		if nid == nil || *nid == id {
			return "", nil
		}
		n, err := s.repo.Column(ctx, *nid)
		if err != nil || n.BoardID != col.BoardID {
			return "", invalid
		}
		return n.Position, nil
	}
	a, err := neighbour(afterID)
	if err != nil {
		return domain.Column{}, err
	}
	b, err := neighbour(beforeID)
	if err != nil {
		return domain.Column{}, err
	}
	switch {
	case a != "" && b == "":
		b, err = s.repo.NextColumnAfter(ctx, col.BoardID, a)
	case b != "" && a == "":
		a, err = s.repo.PrevColumnBefore(ctx, col.BoardID, b)
	case a == "" && b == "":
		a, err = s.repo.LastColumn(ctx, col.BoardID)
	}
	if err != nil {
		return domain.Column{}, err
	}
	pos, err := fractional.Between(a, b)
	if err != nil {
		return domain.Column{}, invalid
	}
	if err := s.repo.SetColumnPosition(ctx, id, pos); err != nil {
		return domain.Column{}, err
	}
	col.Position = pos
	s.columnsChanged(ctx, col, user, "moved")
	return col, nil
}

// DeleteColumn removes an empty column; every status keeps at least one column.
func (s *Service) DeleteColumn(ctx context.Context, user, id uuid.UUID) error {
	col, err := s.loadColumn(ctx, user, id)
	if err != nil {
		return err
	}
	if s.cards != nil {
		n, err := s.cards.CountInColumn(ctx, id)
		if err != nil {
			return err
		}
		if n > 0 {
			return apperr.New(domain.ErrColumnNotEmpty, "move the cards out of the column first").WithMeta("cards", n)
		}
	}
	target, err := s.repo.OtherColumnInCategory(ctx, col.BoardID, col.Category, id)
	if err != nil {
		return err
	}
	// Archived cards keep a column so they can be restored; move them to a sibling first.
	if s.cards != nil {
		if err := s.cards.RelocateArchived(ctx, id, target); err != nil {
			return err
		}
	}
	if err := s.repo.DeleteColumn(ctx, id); err != nil {
		return err
	}
	s.columnsChanged(ctx, col, user, "deleted")
	return nil
}
