package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
)

// ArchiveChildren archives every live subtask of a card (deleting a parent deletes its subtasks).
func (r *Repo) ArchiveChildren(ctx context.Context, parent uuid.UUID) error {
	return r.q.ArchiveChildren(ctx, uuid.NullUUID{UUID: parent, Valid: true})
}

// Parents resolves parent cards (id, number, title, project) for presentation.
func (r *Repo) Parents(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.Ref, error) {
	out := map[uuid.UUID]domain.Ref{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx,
		`SELECT id, workspace_id, project_id, number, title FROM cards WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.Ref
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.ProjectID, &p.Number, &p.Title); err != nil {
			return nil, err
		}
		out[p.ID] = p
	}
	return out, rows.Err()
}
