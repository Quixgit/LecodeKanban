package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

// Estimate is the card's expected time in seconds, nil when none was set.
func (r *Repo) Estimate(ctx context.Context, card uuid.UUID) (*int, error) {
	var s int
	err := r.pool.QueryRow(ctx, `SELECT seconds FROM card_estimates WHERE card_id = $1`, card).Scan(&s)
	if db.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// SetEstimate stores the estimate; nil removes it.
func (r *Repo) SetEstimate(ctx context.Context, card uuid.UUID, seconds *int) error {
	if seconds == nil {
		_, err := r.pool.Exec(ctx, `DELETE FROM card_estimates WHERE card_id = $1`, card)
		return err
	}
	_, err := r.pool.Exec(ctx, `INSERT INTO card_estimates (card_id, seconds) VALUES ($1, $2)
		ON CONFLICT (card_id) DO UPDATE SET seconds = EXCLUDED.seconds, updated_at = now()`, card, *seconds)
	return err
}

// SheetRow is an entry with the task it belongs to.
type SheetRow struct {
	domain.Entry
	ProjectID  uuid.UUID
	CardNumber int
	CardTitle  string
}

// SheetFilter narrows a timesheet.
type SheetFilter struct {
	UserID    uuid.UUID
	From, To  time.Time
	ProjectID *uuid.UUID
}

// Sheet lists one person's entries that started in [From, To), with their tasks, oldest first.
// Running timers are included (their Seconds are computed by the caller).
func (r *Repo) Sheet(ctx context.Context, ws uuid.UUID, f SheetFilter) ([]SheetRow, error) {
	args := []any{ws, f.UserID, f.From, f.To}
	cond := "e.workspace_id = $1 AND e.user_id = $2 AND e.started_at >= $3 AND e.started_at < $4"
	if f.ProjectID != nil {
		args = append(args, *f.ProjectID)
		cond += fmt.Sprintf(" AND c.project_id = $%d", len(args))
	}
	rows, err := r.pool.Query(ctx, `SELECT e.id, e.workspace_id, e.card_id, e.user_id, e.started_at, e.ended_at, e.seconds, e.note, e.manual,
		e.created_at, c.project_id, c.number, c.title
		FROM time_entries e JOIN cards c ON c.id = e.card_id WHERE `+cond+` ORDER BY e.started_at, e.id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SheetRow{}
	for rows.Next() {
		var x SheetRow
		var secs int32
		if err := rows.Scan(&x.ID, &x.WorkspaceID, &x.CardID, &x.UserID, &x.StartedAt, &x.EndedAt, &secs, &x.Note, &x.Manual,
			&x.CreatedAt, &x.ProjectID, &x.CardNumber, &x.CardTitle); err != nil {
			return nil, err
		}
		x.Seconds = int(secs)
		out = append(out, x)
	}
	return out, rows.Err()
}

// UpdateEntry changes a stopped entry; its end follows its start and duration.
func (r *Repo) UpdateEntry(ctx context.Context, id uuid.UUID, seconds int, note string, startedAt time.Time) (domain.Entry, error) {
	end := startedAt.Add(time.Duration(seconds) * time.Second)
	var e domain.Entry
	var secs int32
	err := r.pool.QueryRow(ctx, `UPDATE time_entries SET seconds = $2, note = $3, started_at = $4, ended_at = $5
		WHERE id = $1 AND ended_at IS NOT NULL
		RETURNING id, workspace_id, card_id, user_id, started_at, ended_at, seconds, note, manual, created_at`,
		id, seconds, note, startedAt, end).Scan(&e.ID, &e.WorkspaceID, &e.CardID, &e.UserID, &e.StartedAt, &e.EndedAt, &secs, &e.Note, &e.Manual, &e.CreatedAt)
	if db.IsNoRows(err) {
		return domain.Entry{}, apperr.Wrap(domain.ErrNotFound, "time entry not found", err)
	}
	e.Seconds = int(secs)
	return e, err
}
