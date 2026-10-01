// Package repository persists projects.
package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func nullUUID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func uuidPtr(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func toDomain(p store.Project) domain.Project {
	return domain.Project{
		ID: p.ID, WorkspaceID: p.WorkspaceID, Key: p.Key, Name: p.Name, Description: p.Description,
		Status: domain.Status(p.Status), PICID: uuidPtr(p.PicUserID), Team: p.Team, Icon: p.Icon, Tone: p.Tone,
		StartDate: p.StartDate, Deadline: p.Deadline, TaskCount: int(p.TaskCount), DoneCount: int(p.DoneCount),
		CreatedBy: uuidPtr(p.CreatedBy), CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}
}

// KeyTaken reports a duplicate project key in the workspace.
func KeyTaken(err error) bool { return db.IsUniqueViolation(err, "projects_workspace_key") }

func (r *Repo) Create(ctx context.Context, ws, by uuid.UUID, n domain.NewProject) (domain.Project, error) {
	p, err := r.q.CreateProject(ctx, store.CreateProjectParams{
		WorkspaceID: ws, Key: n.Key, Name: n.Name, Description: n.Description, Status: string(n.Status),
		PicUserID: nullUUID(n.PICID), Team: n.Team, Icon: n.Icon, Tone: n.Tone, StartDate: n.StartDate,
		Deadline: n.Deadline, CreatedBy: uuid.NullUUID{UUID: by, Valid: true},
	})
	if err != nil {
		return domain.Project{}, err
	}
	return toDomain(p), nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Project, error) {
	p, err := r.q.GetProject(ctx, id)
	if db.IsNoRows(err) {
		return domain.Project{}, apperr.Wrap(domain.ErrNotFound, "project not found", err)
	}
	if err != nil {
		return domain.Project{}, err
	}
	return toDomain(p), nil
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, p domain.Patch) (domain.Project, error) {
	var status *string
	if p.Status != nil {
		s := string(*p.Status)
		status = &s
	}
	row, err := r.q.UpdateProject(ctx, store.UpdateProjectParams{
		ID: id, Name: p.Name, Description: p.Description, Status: status, Icon: p.Icon, Tone: p.Tone,
		SetPic: p.SetPIC, PicUserID: nullUUID(p.PICID), SetTeam: p.SetTeam, Team: p.Team,
		SetStart: p.SetStart, StartDate: p.StartDate, SetDeadline: p.SetDeadline, Deadline: p.Deadline,
	})
	if db.IsNoRows(err) {
		return domain.Project{}, apperr.Wrap(domain.ErrNotFound, "project not found", err)
	}
	if err != nil {
		return domain.Project{}, err
	}
	return toDomain(row), nil
}

func (r *Repo) Archive(ctx context.Context, id uuid.UUID) error { return r.q.ArchiveProject(ctx, id) }

func (r *Repo) SetCounts(ctx context.Context, id uuid.UUID, total, done int) error {
	return r.q.SetProjectCounts(ctx, store.SetProjectCountsParams{ID: id, TaskCount: int32(total), DoneCount: int32(done)}) //nolint:gosec // G115: card counts fit int32
}

func (r *Repo) Summary(ctx context.Context, ws uuid.UUID, today time.Time) (domain.Summary, error) {
	s, err := r.q.ProjectSummary(ctx, store.ProjectSummaryParams{WorkspaceID: ws, Today: today})
	if err != nil {
		return domain.Summary{}, err
	}
	teams, err := r.q.DistinctTeams(ctx, ws)
	if err != nil {
		return domain.Summary{}, err
	}
	return domain.Summary{Total: int(s.Total), Completed: int(s.Completed), InProgress: int(s.InProgress),
		Pending: int(s.Pending), Overdue: int(s.Overdue), Teams: teams}, nil
}

func (r *Repo) Refs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]domain.Ref, error) {
	rows, err := r.q.ProjectsByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]domain.Ref, len(rows))
	for _, p := range rows {
		out[p.ID] = domain.Ref{ID: p.ID, WorkspaceID: p.WorkspaceID, Key: p.Key, Name: p.Name, Icon: p.Icon, Tone: p.Tone}
	}
	return out, nil
}

// sortColumns whitelists ORDER BY expressions (never interpolate user input).
var sortColumns = map[string]string{
	"updated":  "updated_at",
	"created":  "created_at",
	"name":     "lower(name)",
	"deadline": "deadline",
	"progress": "progress_pct",
}

const progressExpr = "(CASE WHEN task_count = 0 THEN CASE WHEN status = 'completed' THEN 100 ELSE 0 END ELSE done_count * 100 / task_count END)"

// EscapeLike escapes LIKE metacharacters in user search text.
func EscapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// List runs the filtered, sorted, paginated project query.
func (r *Repo) List(ctx context.Context, ws uuid.UUID, f domain.Filter, today time.Time, pg pagination.Params) ([]domain.Project, int, error) {
	where := []string{"workspace_id = $1", "archived_at IS NULL"}
	args := []any{ws}
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }

	if q := strings.TrimSpace(f.Query); q != "" {
		p := arg("%" + EscapeLike(q) + "%")
		where = append(where, fmt.Sprintf("(name ILIKE %s OR key ILIKE %s)", p, p))
	}
	if f.Status != nil {
		where = append(where, "status = "+arg(string(*f.Status)))
	}
	if f.PICID != nil {
		where = append(where, "pic_user_id = "+arg(*f.PICID))
	}
	if f.Team != nil {
		where = append(where, "team = "+arg(*f.Team))
	}
	switch f.Progress {
	case "not_started":
		where = append(where, progressExpr+" = 0")
	case "early":
		where = append(where, progressExpr+" BETWEEN 1 AND 33")
	case "midway":
		where = append(where, progressExpr+" BETWEEN 34 AND 66")
	case "almost":
		where = append(where, progressExpr+" BETWEEN 67 AND 99")
	case "done":
		where = append(where, progressExpr+" = 100")
	}
	if f.Deadline != "" {
		t := arg(today)
		switch f.Deadline {
		case "overdue":
			where = append(where, fmt.Sprintf("status <> 'completed' AND deadline < %s::date", t))
		case "week":
			where = append(where, fmt.Sprintf("deadline BETWEEN %s::date AND %s::date + 7", t, t))
		case "month":
			where = append(where, fmt.Sprintf("deadline BETWEEN %s::date AND %s::date + 30", t, t))
		case "later":
			where = append(where, fmt.Sprintf("deadline > %s::date + 30", t))
		case "none":
			where = append(where, "deadline IS NULL")
		}
	}
	col, ok := sortColumns[f.Sort]
	if !ok {
		col = "updated_at"
		f.Desc = true
	}
	dir := "ASC"
	if f.Desc {
		dir = "DESC"
	}
	sql := fmt.Sprintf(`SELECT *, %s AS progress_pct, count(*) OVER () AS total_count
		FROM projects WHERE %s ORDER BY %s %s NULLS LAST, id LIMIT %s OFFSET %s`,
		progressExpr, strings.Join(where, " AND "), col, dir, arg(pg.Limit()), arg(pg.Offset()))

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []domain.Project
	total := 0
	for rows.Next() {
		var p store.Project
		var pct int32
		var n int64
		if err := rows.Scan(&p.ID, &p.WorkspaceID, &p.Key, &p.Name, &p.Description, &p.Status, &p.PicUserID, &p.Team,
			&p.Icon, &p.Tone, &p.StartDate, &p.Deadline, &p.TaskCount, &p.DoneCount, &p.CreatedBy, &p.CreatedAt,
			&p.UpdatedAt, &p.ArchivedAt, &pct, &n); err != nil {
			return nil, 0, err
		}
		out = append(out, toDomain(p))
		total = int(n)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(out) == 0 && pg.Page > 1 {
		// Past the last page: still report the real total.
		err = r.pool.QueryRow(ctx, "SELECT count(*) FROM projects WHERE "+strings.Join(where, " AND "), args[:len(args)-2]...).Scan(&total)
	}
	return out, total, err
}
