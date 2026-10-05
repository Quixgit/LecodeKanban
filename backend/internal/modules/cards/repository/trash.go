package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

// TrashLimit caps one look into the trash.
const TrashLimit = 200

// Trash lists deleted tasks, newest first. Subtasks that went with their parent are not listed on their own:
// they come back with it. Tasks of archived projects stay out.
func (r *Repo) Trash(ctx context.Context, ws uuid.UUID, project *uuid.UUID) ([]domain.Card, error) {
	args := []any{ws}
	cond := `c.workspace_id = $1 AND c.archived_at IS NOT NULL AND pd.archived_at IS NULL
	  AND (c.parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM cards p WHERE p.id = c.parent_id AND c.archived_at BETWEEN p.archived_at AND p.archived_at + interval '5 seconds'))`
	if project != nil {
		args = append(args, *project)
		cond += fmt.Sprintf(" AND c.project_id = $%d", len(args))
	}
	args = append(args, TrashLimit)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`SELECT %s FROM %s WHERE %s ORDER BY c.archived_at DESC, c.id LIMIT $%d`,
		cardCols, from, cond, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Card{}
	for rows.Next() {
		var c store.Card
		if err := rows.Scan(cardDest(&c)...); err != nil {
			return nil, err
		}
		out = append(out, toDomain(c))
	}
	return out, rows.Err()
}

// Archived returns a task that is in the trash.
func (r *Repo) Archived(ctx context.Context, id uuid.UUID) (domain.Card, error) {
	var c store.Card
	err := r.pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM %s WHERE c.id = $1 AND c.archived_at IS NOT NULL`, cardCols, from), id).
		Scan(cardDest(&c)...)
	if err != nil {
		if db.IsNoRows(err) {
			return domain.Card{}, notFound(err)
		}
		return domain.Card{}, err
	}
	return toDomain(c), nil
}

// Restore brings a trashed task back together with the subtasks that were deleted with it (the delete archives the
// parent first and its subtasks a moment later, so "with it" means within a few seconds).
func (r *Repo) Restore(ctx context.Context, c domain.Card) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE cards SET archived_at = NULL, version = version + 1, updated_at = now()
		 WHERE archived_at IS NOT NULL AND (id = $1 OR (parent_id = $1 AND archived_at BETWEEN $2 AND $2 + interval '5 seconds'))`, c.ID, c.ArchivedAt)
	return err
}
