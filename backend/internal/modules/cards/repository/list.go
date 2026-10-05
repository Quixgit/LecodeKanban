package repository

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/pagination"
)

var keyQuery = regexp.MustCompile(`^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$`)

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// where builds the shared WHERE clause for list and count queries. Cross-module
// data comes only from the published project_directory / user_directory views.
func where(ws uuid.UUID, f domain.Filter, today time.Time) (string, []any) {
	conds := []string{"c.workspace_id = $1", "c.archived_at IS NULL", "pd.archived_at IS NULL"}
	args := []any{ws}
	arg := func(v any) string { args = append(args, v); return fmt.Sprintf("$%d", len(args)) }

	if f.Status != nil {
		conds = append(conds, "c.status = "+arg(string(*f.Status)))
	}
	if f.ProjectID != nil {
		conds = append(conds, "c.project_id = "+arg(*f.ProjectID))
	}
	if f.AssigneeID != nil {
		conds = append(conds, "EXISTS (SELECT 1 FROM card_assignees a WHERE a.card_id = c.id AND a.user_id = "+arg(*f.AssigneeID)+")")
	}
	if f.Priority != nil {
		conds = append(conds, "c.priority = "+arg(string(*f.Priority)))
	}
	if f.LabelID != nil {
		conds = append(conds, "EXISTS (SELECT 1 FROM card_labels l WHERE l.card_id = c.id AND l.label_id = "+arg(*f.LabelID)+")")
	}
	if f.FieldID != nil && f.FieldValue != "" {
		fid := arg(*f.FieldID)
		if f.FieldContains {
			conds = append(conds, "EXISTS (SELECT 1 FROM card_field_directory v WHERE v.card_id = c.id AND v.field_id = "+fid+
				" AND (v.value #>> '{}') ILIKE "+arg("%"+escapeLike(f.FieldValue)+"%")+")")
		} else {
			conds = append(conds, "EXISTS (SELECT 1 FROM card_field_directory v WHERE v.card_id = c.id AND v.field_id = "+fid+
				" AND (v.value #>> '{}') = "+arg(f.FieldValue)+")")
		}
	}
	if f.ParentID != nil {
		conds = append(conds, "c.parent_id = "+arg(*f.ParentID))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		if m := keyQuery.FindStringSubmatch(q); m != nil {
			n, _ := strconv.Atoi(m[2])
			conds = append(conds, fmt.Sprintf("(pd.key = %s AND c.number = %s)", arg(strings.ToUpper(m[1])), arg(n)))
		} else {
			conds = append(conds, "c.title ILIKE "+arg("%"+escapeLike(q)+"%"))
		}
	}
	switch f.Due {
	case "overdue":
		conds = append(conds, fmt.Sprintf("c.status <> 'done' AND c.due_date < %s::date", arg(today)))
	case "today":
		conds = append(conds, fmt.Sprintf("c.due_date = %s::date", arg(today)))
	case "week":
		t := arg(today)
		conds = append(conds, fmt.Sprintf("c.due_date BETWEEN %s::date AND %s::date + 7", t, t))
	case "month":
		t := arg(today)
		conds = append(conds, fmt.Sprintf("c.due_date BETWEEN %s::date AND %s::date + 30", t, t))
	case "none":
		conds = append(conds, "c.due_date IS NULL")
	}
	return strings.Join(conds, " AND "), args
}

const from = "cards c JOIN project_directory pd ON pd.id = c.project_id"

// cardCols / cardDest keep hand-written queries in step with store.Card.
const cardCols = `c.id, c.workspace_id, c.project_id, c.board_id, c.column_id, c.number, c.title, c.description,
	c.status, c.priority, c.progress, c.due_date, c.position, c.version, c.created_by, c.completed_at, c.created_at,
	c.updated_at, c.archived_at, c.checklist_total, c.checklist_done, c.comment_count, c.attachment_count, c.parent_id, c.subtask_total,
	c.subtask_done`

func cardDest(c *store.Card) []any {
	return []any{&c.ID, &c.WorkspaceID, &c.ProjectID, &c.BoardID, &c.ColumnID, &c.Number, &c.Title, &c.Description,
		&c.Status, &c.Priority, &c.Progress, &c.DueDate, &c.Position, &c.Version, &c.CreatedBy, &c.CompletedAt,
		&c.CreatedAt, &c.UpdatedAt, &c.ArchivedAt, &c.ChecklistTotal, &c.ChecklistDone, &c.CommentCount, &c.AttachmentCount, &c.ParentID, &c.SubtaskTotal, &c.SubtaskDone}
}

// BoardLimit caps one board load; the response reports truncation.
const BoardLimit = 3000

// Board returns every card matching f in board order (position), up to BoardLimit.
func (r *Repo) Board(ctx context.Context, ws uuid.UUID, f domain.Filter, today time.Time) ([]domain.Card, bool, error) {
	cond, args := where(ws, f, today)
	args = append(args, BoardLimit+1)
	rows, err := r.pool.Query(ctx, fmt.Sprintf(`SELECT %s FROM %s WHERE %s ORDER BY c.position, c.id LIMIT $%d`,
		cardCols, from, cond, len(args)), args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	out := []domain.Card{}
	for rows.Next() {
		var c store.Card
		if err := rows.Scan(cardDest(&c)...); err != nil {
			return nil, false, err
		}
		out = append(out, toDomain(c))
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	if len(out) > BoardLimit {
		return out[:BoardLimit], true, nil
	}
	return out, false, nil
}

// sortExprs whitelists ORDER BY expressions.
var sortExprs = map[string]string{
	"key":      "pd.key %[1]s, c.number %[1]s",
	"title":    "lower(c.title) %[1]s",
	"project":  "lower(pd.name) %[1]s, c.number",
	"assignee": "(SELECT min(lower(u.name)) FROM card_assignees a JOIN user_directory u ON u.id = a.user_id WHERE a.card_id = c.id) %[1]s NULLS LAST",
	"progress": "c.progress %[1]s",
	"deadline": "c.due_date %[1]s NULLS LAST",
	"priority": "CASE c.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END %[1]s",
	"position": "c.position %[1]s",
	"updated":  "c.updated_at %[1]s",
}

// List returns one page of cards for the filter, plus the total.
func (r *Repo) List(ctx context.Context, ws uuid.UUID, f domain.Filter, today time.Time, pg pagination.Params) ([]domain.Card, int, error) {
	cond, args := where(ws, f, today)
	expr, ok := sortExprs[f.Sort]
	dir := "ASC"
	if f.Desc {
		dir = "DESC"
	}
	if f.SortField != nil {
		// Cards without a value come last. jsonb orders numbers as numbers and strings as strings.
		args = append(args, *f.SortField)
		expr = fmt.Sprintf("(SELECT v.value FROM card_field_directory v WHERE v.card_id = c.id AND v.field_id = $%d) %%[1]s NULLS LAST", len(args))
		ok = true
	}
	if !ok {
		expr, dir = sortExprs["updated"], "DESC"
	}
	order := fmt.Sprintf(expr, dir)
	args = append(args, pg.Limit(), pg.Offset())
	sql := fmt.Sprintf(`SELECT %s, count(*) OVER () FROM %s WHERE %s ORDER BY %s, c.id LIMIT $%d OFFSET $%d`,
		cardCols, from, cond, order, len(args)-1, len(args))

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []domain.Card
	total := 0
	for rows.Next() {
		var c store.Card
		var n int64
		if err := rows.Scan(append(cardDest(&c), &n)...); err != nil {
			return nil, 0, err
		}
		out = append(out, toDomain(c))
		total = int(n)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(out) == 0 && pg.Page > 1 {
		cnt, err := r.count(ctx, ws, f, today)
		return out, cnt, err
	}
	return out, total, nil
}

func (r *Repo) count(ctx context.Context, ws uuid.UUID, f domain.Filter, today time.Time) (int, error) {
	cond, args := where(ws, f, today)
	var n int
	err := r.pool.QueryRow(ctx, fmt.Sprintf("SELECT count(*) FROM %s WHERE %s", from, cond), args...).Scan(&n)
	return n, err
}

// Counts returns card counts per status for the filter (status filter ignored).
func (r *Repo) Counts(ctx context.Context, ws uuid.UUID, f domain.Filter, today time.Time) (domain.Counts, error) {
	f.Status = nil
	cond, args := where(ws, f, today)
	rows, err := r.pool.Query(ctx, fmt.Sprintf("SELECT c.status, count(*) FROM %s WHERE %s GROUP BY c.status", from, cond), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := domain.Counts{}
	for _, s := range domain.Statuses {
		out[s] = 0
	}
	for rows.Next() {
		var s string
		var n int
		if err := rows.Scan(&s, &n); err != nil {
			return nil, err
		}
		out[domain.Status(s)] = n
	}
	return out, rows.Err()
}

// InWorkspace returns which of ids are live cards of ws (bulk safety).
func (r *Repo) InWorkspace(ctx context.Context, ws uuid.UUID, ids []uuid.UUID) ([]domain.Card, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+cardCols+`
		FROM `+from+` WHERE c.workspace_id = $1 AND c.id = ANY($2::uuid[]) AND c.archived_at IS NULL AND pd.archived_at IS NULL`, ws, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Card
	for rows.Next() {
		var c store.Card
		if err := rows.Scan(cardDest(&c)...); err != nil {
			return nil, err
		}
		out = append(out, toDomain(c))
	}
	return out, rows.Err()
}

// Stats gathers dashboard data.
func (r *Repo) Stats(ctx context.Context, ws uuid.UUID, today time.Time, days int) (domain.Stats, error) {
	// The KPIs follow the period the dashboard shows: the last `days` days against the `days` before.
	weekStart := today.AddDate(0, 0, -(days - 1))
	prevWeekStart := weekStart.AddDate(0, 0, -days)
	k, err := r.q.CardKPIs(ctx, store.CardKPIsParams{WorkspaceID: ws, Today: today, WeekStart: &weekStart, PrevWeekStart: &prevWeekStart})
	if err != nil {
		return domain.Stats{}, err
	}
	counts, err := r.Counts(ctx, ws, domain.Filter{}, today)
	if err != nil {
		return domain.Stats{}, err
	}
	since := today.AddDate(0, 0, -(days - 1))
	rows, err := r.q.TransitionsByDay(ctx, store.TransitionsByDayParams{WorkspaceID: ws, Since: since})
	if err != nil {
		return domain.Stats{}, err
	}
	byDay := map[string]domain.Counts{}
	for _, row := range rows {
		key := row.Day.Format(time.DateOnly)
		if byDay[key] == nil {
			byDay[key] = domain.Counts{}
		}
		byDay[key][domain.Status(row.ToStatus)] += int(row.N)
	}
	daily := make([]domain.Day, days)
	for i := range daily {
		d := since.AddDate(0, 0, i)
		c := byDay[d.Format(time.DateOnly)]
		if c == nil {
			c = domain.Counts{}
		}
		daily[i] = domain.Day{Date: d, Counts: c}
	}
	recent, err := r.q.RecentTransitions(ctx, store.RecentTransitionsParams{WorkspaceID: ws, Limit: 8})
	if err != nil {
		return domain.Stats{}, err
	}
	activity := make([]domain.Transition, len(recent))
	for i, t := range recent {
		tr := domain.Transition{ID: t.ID, CardID: t.CardID, ProjectID: t.ProjectID, Title: t.Title, Number: int(t.Number),
			To: domain.Status(t.ToStatus), ActorID: uuidPtr(t.ActorID), At: t.At}
		if t.FromStatus != nil {
			s := domain.Status(*t.FromStatus)
			tr.From = &s
		}
		activity[i] = tr
	}
	return domain.Stats{
		KPIs: domain.KPIs{Active: int(k.Active), Total: int(k.Total), InReview: int(k.InReview), Overdue: int(k.Overdue),
			DoneThisWeek: int(k.DoneThisWeek), DonePrevWeek: int(k.DonePrevWeek),
			CreatedThisWeek: int(k.CreatedThisWeek), CreatedPrevWeek: int(k.CreatedPrevWeek)},
		Counts: counts, Daily: daily, Activity: activity,
	}, nil
}
