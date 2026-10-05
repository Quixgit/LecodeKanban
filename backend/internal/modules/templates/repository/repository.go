// Package repository persists task templates and recurring schedules.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const tplCols = `id, workspace_id, name, title, description, priority, label_ids, assignee_ids, checklist, subtasks, due_in_days, created_by, created_at, updated_at`

func scanTemplate(row pgx.Row) (domain.Template, error) {
	var t domain.Template
	err := row.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Title, &t.Description, &t.Priority, &t.LabelIDs, &t.AssigneeIDs,
		&t.Checklist, &t.Subtasks, &t.DueInDays, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

func (r *Repo) Templates(ctx context.Context, ws uuid.UUID) ([]domain.Template, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+tplCols+` FROM task_templates WHERE workspace_id = $1 ORDER BY lower(name)`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Template{}
	for rows.Next() {
		t, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repo) Template(ctx context.Context, id uuid.UUID) (domain.Template, error) {
	t, err := scanTemplate(r.pool.QueryRow(ctx, `SELECT `+tplCols+` FROM task_templates WHERE id = $1`, id))
	if db.IsNoRows(err) {
		return domain.Template{}, apperr.Wrap(domain.ErrNotFound, "template not found", err)
	}
	return t, err
}

func (r *Repo) CountTemplates(ctx context.Context, ws uuid.UUID) (n int, err error) {
	err = r.pool.QueryRow(ctx, `SELECT count(*) FROM task_templates WHERE workspace_id = $1`, ws).Scan(&n)
	return
}

func nameTaken(err error) error {
	if db.IsUniqueViolation(err, "task_templates_name_idx") {
		return apperr.Wrap(domain.ErrNameTaken, "a template with this name exists", err)
	}
	return err
}

func (r *Repo) CreateTemplate(ctx context.Context, t domain.Template) (domain.Template, error) {
	out, err := scanTemplate(r.pool.QueryRow(ctx, `INSERT INTO task_templates
		(workspace_id, name, title, description, priority, label_ids, assignee_ids, checklist, subtasks, due_in_days, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING `+tplCols,
		t.WorkspaceID, t.Name, t.Title, t.Description, t.Priority, t.LabelIDs, t.AssigneeIDs, t.Checklist, t.Subtasks, t.DueInDays, t.CreatedBy))
	return out, nameTaken(err)
}

func (r *Repo) UpdateTemplate(ctx context.Context, t domain.Template) (domain.Template, error) {
	out, err := scanTemplate(r.pool.QueryRow(ctx, `UPDATE task_templates SET name=$2, title=$3, description=$4, priority=$5,
		label_ids=$6, assignee_ids=$7, checklist=$8, subtasks=$9, due_in_days=$10, updated_at=now()
		WHERE id=$1 RETURNING `+tplCols,
		t.ID, t.Name, t.Title, t.Description, t.Priority, t.LabelIDs, t.AssigneeIDs, t.Checklist, t.Subtasks, t.DueInDays))
	if db.IsNoRows(err) {
		return domain.Template{}, apperr.Wrap(domain.ErrNotFound, "template not found", err)
	}
	return out, nameTaken(err)
}

func (r *Repo) DeleteTemplate(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM task_templates WHERE id = $1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return apperr.New(domain.ErrNotFound, "template not found")
	}
	return err
}

const recCols = `id, workspace_id, template_id, project_id, freq, weekdays, COALESCE(month_day, 0), hour, timezone, active,
	next_run_at, last_run_at, last_card_id, last_error, created_by, created_at`

func scanRecurrence(row pgx.Row) (domain.Recurrence, error) {
	var x domain.Recurrence
	var freq string
	var weekdays []int16
	var monthDay, hour int16
	err := row.Scan(&x.ID, &x.WorkspaceID, &x.TemplateID, &x.ProjectID, &freq, &weekdays, &monthDay, &hour, &x.Timezone, &x.Active,
		&x.NextRunAt, &x.LastRunAt, &x.LastCardID, &x.LastError, &x.CreatedBy, &x.CreatedAt)
	x.Freq, x.MonthDay, x.Hour = domain.Freq(freq), int(monthDay), int(hour)
	x.Weekdays = make([]int, len(weekdays))
	for i, d := range weekdays {
		x.Weekdays[i] = int(d)
	}
	return x, err
}

func weekdays16(in []int) []int16 {
	out := make([]int16, len(in))
	for i, d := range in {
		out[i] = int16(d)
	}
	return out
}

func (r *Repo) Recurring(ctx context.Context, ws uuid.UUID) ([]domain.Recurrence, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+recCols+` FROM recurring_tasks WHERE workspace_id = $1 ORDER BY created_at`, ws)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Recurrence{}
	for rows.Next() {
		x, err := scanRecurrence(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (r *Repo) RecurringByID(ctx context.Context, id uuid.UUID) (domain.Recurrence, error) {
	x, err := scanRecurrence(r.pool.QueryRow(ctx, `SELECT `+recCols+` FROM recurring_tasks WHERE id = $1`, id))
	if db.IsNoRows(err) {
		return domain.Recurrence{}, apperr.Wrap(domain.ErrRecurringMissing, "recurring task not found", err)
	}
	return x, err
}

func (r *Repo) CountRecurring(ctx context.Context, ws uuid.UUID) (n int, err error) {
	err = r.pool.QueryRow(ctx, `SELECT count(*) FROM recurring_tasks WHERE workspace_id = $1`, ws).Scan(&n)
	return
}

func (r *Repo) CreateRecurring(ctx context.Context, x domain.Recurrence) (domain.Recurrence, error) {
	return scanRecurrence(r.pool.QueryRow(ctx, `INSERT INTO recurring_tasks
		(workspace_id, template_id, project_id, freq, weekdays, month_day, hour, timezone, active, next_run_at, created_by)
		VALUES ($1,$2,$3,$4,$5,NULLIF($6,0),$7,$8,$9,$10,$11) RETURNING `+recCols,
		x.WorkspaceID, x.TemplateID, x.ProjectID, string(x.Freq), weekdays16(x.Weekdays), x.MonthDay, x.Hour, x.Timezone, x.Active,
		x.NextRunAt, x.CreatedBy))
}

// UpdateRecurring replaces the schedule; a changed schedule forgets the last error.
func (r *Repo) UpdateRecurring(ctx context.Context, x domain.Recurrence) (domain.Recurrence, error) {
	out, err := scanRecurrence(r.pool.QueryRow(ctx, `UPDATE recurring_tasks SET template_id=$2, project_id=$3, freq=$4, weekdays=$5,
		month_day=NULLIF($6,0), hour=$7, timezone=$8, active=$9, next_run_at=$10, last_error=NULL WHERE id=$1 RETURNING `+recCols,
		x.ID, x.TemplateID, x.ProjectID, string(x.Freq), weekdays16(x.Weekdays), x.MonthDay, x.Hour, x.Timezone, x.Active, x.NextRunAt))
	if db.IsNoRows(err) {
		return domain.Recurrence{}, apperr.Wrap(domain.ErrRecurringMissing, "recurring task not found", err)
	}
	return out, err
}

func (r *Repo) DeleteRecurring(ctx context.Context, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM recurring_tasks WHERE id = $1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return apperr.New(domain.ErrRecurringMissing, "recurring task not found")
	}
	return err
}

// ClaimDue takes the schedules that are due and moves each to its next run in the same transaction, so that
// several servers never create the same task twice (SKIP LOCKED). A schedule that has no next run is switched off.
// Only one run is made up for a long outage: a daily task missed for a week is created once, not seven times.
func (r *Repo) ClaimDue(ctx context.Context, now time.Time, limit int) ([]domain.Recurrence, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	rows, err := tx.Query(ctx, `SELECT `+recCols+` FROM recurring_tasks WHERE active AND next_run_at <= $1
		ORDER BY next_run_at LIMIT $2 FOR UPDATE SKIP LOCKED`, now, limit)
	if err != nil {
		return nil, err
	}
	var due []domain.Recurrence
	for rows.Next() {
		x, err := scanRecurrence(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		due = append(due, x)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, x := range due {
		next := x.Next(now)
		if next.IsZero() {
			_, err = tx.Exec(ctx, `UPDATE recurring_tasks SET active = false, last_run_at = $2 WHERE id = $1`, x.ID, now)
		} else {
			_, err = tx.Exec(ctx, `UPDATE recurring_tasks SET next_run_at = $2, last_run_at = $3 WHERE id = $1`, x.ID, next, now)
		}
		if err != nil {
			return nil, err
		}
	}
	return due, tx.Commit(ctx)
}

// RecordRun stores the outcome of one run.
func (r *Repo) RecordRun(ctx context.Context, id uuid.UUID, card *uuid.UUID, runErr string) error {
	var msg *string
	if runErr != "" {
		msg = &runErr
	}
	_, err := r.pool.Exec(ctx, `UPDATE recurring_tasks SET last_card_id = COALESCE($2, last_card_id), last_error = $3 WHERE id = $1`, id, card, msg)
	return err
}

// Deactivate switches a schedule off, with the reason.
func (r *Repo) Deactivate(ctx context.Context, id uuid.UUID, reason string) error {
	_, err := r.pool.Exec(ctx, `UPDATE recurring_tasks SET active = false, last_error = $2 WHERE id = $1`, id, reason)
	return err
}
