package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
)

// PerfFilter narrows the tasks the Performance page looks at.
type PerfFilter struct {
	ProjectID, AssigneeID, LabelID *uuid.UUID
}

// PerfStep is one status change of a task.
type PerfStep struct {
	To domain.Status
	At time.Time
}

// PerfCard is a task with its whole status history, enough to derive every flow metric.
type PerfCard struct {
	ID, ProjectID uuid.UUID
	Number        int
	Title         string
	Status        domain.Status
	DueDate       *time.Time
	CreatedAt     time.Time
	CompletedAt   *time.Time
	Assignees     []uuid.UUID
	Steps         []PerfStep
}

// maxPerfCards bounds one report; a workspace beyond it is analysed on its most recently created tasks.
const maxPerfCards = 50000

// PerformanceData loads the live tasks that match f with their assignees and status history: three
// queries, no new tables. The aggregation itself is plain Go (see the service), so it can be tested without a database.
func (r *Repo) PerformanceData(ctx context.Context, ws uuid.UUID, f PerfFilter) ([]PerfCard, error) {
	args := []any{ws}
	cond := "c.workspace_id = $1 AND c.archived_at IS NULL AND pd.archived_at IS NULL"
	if f.ProjectID != nil {
		args = append(args, *f.ProjectID)
		cond += fmt.Sprintf(" AND c.project_id = $%d", len(args))
	}
	if f.AssigneeID != nil {
		args = append(args, *f.AssigneeID)
		cond += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM card_assignees a WHERE a.card_id = c.id AND a.user_id = $%d)", len(args))
	}
	if f.LabelID != nil {
		args = append(args, *f.LabelID)
		cond += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM card_labels l WHERE l.card_id = c.id AND l.label_id = $%d)", len(args))
	}
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`SELECT c.id, c.project_id, c.number, c.title, c.status, c.due_date, c.created_at, c.completed_at
		FROM %s WHERE %s ORDER BY c.created_at DESC LIMIT %d`, from, cond, maxPerfCards), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cards []PerfCard
	index := map[uuid.UUID]int{}
	ids := []uuid.UUID{}
	for rows.Next() {
		var c PerfCard
		var status string
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.Number, &c.Title, &status, &c.DueDate, &c.CreatedAt, &c.CompletedAt); err != nil {
			return nil, err
		}
		c.Status = domain.Status(status)
		index[c.ID] = len(cards)
		ids = append(ids, c.ID)
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return cards, nil
	}

	ar, err := r.pool.Query(ctx, `SELECT card_id, user_id FROM card_assignees WHERE card_id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer ar.Close()
	for ar.Next() {
		var card, user uuid.UUID
		if err := ar.Scan(&card, &user); err != nil {
			return nil, err
		}
		cards[index[card]].Assignees = append(cards[index[card]].Assignees, user)
	}
	if err := ar.Err(); err != nil {
		return nil, err
	}

	tr, err := r.pool.Query(ctx, `SELECT card_id, to_status, at FROM card_transitions WHERE card_id = ANY($1) ORDER BY card_id, at, id`, ids)
	if err != nil {
		return nil, err
	}
	defer tr.Close()
	for tr.Next() {
		var card uuid.UUID
		var to string
		var at time.Time
		if err := tr.Scan(&card, &to, &at); err != nil {
			return nil, err
		}
		c := &cards[index[card]]
		c.Steps = append(c.Steps, PerfStep{To: domain.Status(to), At: at})
	}
	return cards, tr.Err()
}
