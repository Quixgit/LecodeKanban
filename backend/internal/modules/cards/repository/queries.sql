-- name: NextCardNumber :one
INSERT INTO card_counters (project_id, next) VALUES ($1, 2)
ON CONFLICT (project_id) DO UPDATE SET next = card_counters.next + 1
RETURNING (next - 1)::int;

-- name: CreateCard :one
INSERT INTO cards (workspace_id, project_id, board_id, column_id, number, title, description, status, priority,
                   progress, due_date, position, created_by, completed_at)
VALUES (@workspace_id, @project_id, @board_id, @column_id, @number, @title, @description, @status, @priority,
        @progress, sqlc.narg(due_date), @position, @created_by, sqlc.narg(completed_at))
RETURNING *;

-- name: GetCard :one
SELECT * FROM cards WHERE id = $1 AND archived_at IS NULL;

-- name: UpdateCard :one
UPDATE cards SET
    title       = COALESCE(sqlc.narg(title), title),
    description = COALESCE(sqlc.narg(description), description),
    priority    = COALESCE(sqlc.narg(priority), priority),
    due_date    = CASE WHEN @set_due::bool THEN sqlc.narg(due_date) ELSE due_date END,
    version     = version + 1
WHERE id = @id AND version = @version AND archived_at IS NULL
RETURNING *;

-- name: MoveCard :one
UPDATE cards SET
    column_id    = @column_id,
    board_id     = @board_id,
    status       = @status,
    position     = @position,
    progress     = @progress,
    completed_at = CASE WHEN @status = 'done' THEN COALESCE(completed_at, now()) ELSE NULL END,
    version      = version + 1
WHERE id = @id AND version = @version AND archived_at IS NULL
RETURNING *;

-- name: ArchiveCard :execrows
UPDATE cards SET archived_at = now(), version = version + 1 WHERE id = $1 AND archived_at IS NULL;

-- name: LastPosition :one
SELECT COALESCE(max(position), '')::text FROM cards WHERE column_id = $1 AND archived_at IS NULL;

-- name: PositionInColumn :one
SELECT position FROM cards WHERE id = @id AND column_id = @column_id AND archived_at IS NULL;

-- name: NextPositionAfter :one
SELECT COALESCE(min(position), '')::text FROM cards
WHERE column_id = @column_id AND archived_at IS NULL AND position > @after::text;

-- name: PrevPositionBefore :one
SELECT COALESCE(max(position), '')::text FROM cards
WHERE column_id = @column_id AND archived_at IS NULL AND position < @before::text;

-- name: ClearAssignees :exec
DELETE FROM card_assignees WHERE card_id = $1;

-- name: AddAssignees :exec
INSERT INTO card_assignees (card_id, user_id)
SELECT @card_id, unnest(@user_ids::uuid[])
ON CONFLICT DO NOTHING;

-- name: AssigneesForCards :many
SELECT card_id, user_id FROM card_assignees WHERE card_id = ANY(@ids::uuid[]);

-- name: InsertTransition :exec
INSERT INTO card_transitions (card_id, workspace_id, project_id, from_status, to_status, actor_id)
VALUES (@card_id, @workspace_id, @project_id, sqlc.narg(from_status), @to_status, sqlc.narg(actor_id));

-- name: CountByProject :one
SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'done')::int AS done,
       COALESCE(round(avg(progress)), 0)::int AS avg_progress
FROM cards WHERE project_id = $1 AND archived_at IS NULL;

-- Lane-scoped ordering (cross-project board: one lane per status).

-- name: PositionInStatus :one
SELECT position FROM cards
WHERE id = @id AND workspace_id = @workspace_id AND status = @status AND archived_at IS NULL;

-- name: NextPositionAfterInStatus :one
SELECT COALESCE(min(position), '')::text FROM cards
WHERE workspace_id = @workspace_id AND status = @status AND archived_at IS NULL AND position > @after::text;

-- name: PrevPositionBeforeInStatus :one
SELECT COALESCE(max(position), '')::text FROM cards
WHERE workspace_id = @workspace_id AND status = @status AND archived_at IS NULL AND position < @before::text;

-- name: LastPositionInStatus :one
SELECT COALESCE(max(position), '')::text FROM cards
WHERE workspace_id = @workspace_id AND status = @status AND archived_at IS NULL;

-- name: CountInColumn :one
SELECT count(*)::int FROM cards WHERE column_id = $1 AND archived_at IS NULL;

-- Derived data (not user edits: no version bump).

-- name: RefreshChecklistCounts :one
UPDATE cards SET
    checklist_total = (SELECT count(*) FROM checklist_items i WHERE i.card_id = cards.id),
    checklist_done  = (SELECT count(*) FROM checklist_items i WHERE i.card_id = cards.id AND i.done)
WHERE cards.id = $1
RETURNING *;

-- name: SetProgress :exec
UPDATE cards SET progress = @progress WHERE id = @id;

-- name: SetCommentCount :exec
UPDATE cards SET comment_count = @count WHERE id = @id;

-- name: SetAttachmentCount :exec
UPDATE cards SET attachment_count = @count WHERE id = @id;

-- Labels.

-- name: ListLabels :many
SELECT * FROM labels WHERE workspace_id = $1 ORDER BY lower(name);

-- name: GetLabel :one
SELECT * FROM labels WHERE id = $1;

-- name: CreateLabel :one
INSERT INTO labels (workspace_id, name, tone) VALUES (@workspace_id, @name, @tone) RETURNING *;

-- name: UpdateLabel :one
UPDATE labels SET name = COALESCE(sqlc.narg(name), name), tone = COALESCE(sqlc.narg(tone), tone)
WHERE id = @id RETURNING *;

-- name: DeleteLabel :exec
DELETE FROM labels WHERE id = $1;

-- name: CountLabelsInWorkspace :one
SELECT count(*)::int FROM labels WHERE workspace_id = @workspace_id AND id = ANY(@ids::uuid[]);

-- name: ClearCardLabels :exec
DELETE FROM card_labels WHERE card_id = $1;

-- name: AddCardLabels :exec
INSERT INTO card_labels (card_id, label_id)
SELECT @card_id, unnest(@label_ids::uuid[])
ON CONFLICT DO NOTHING;

-- name: LabelsForCards :many
SELECT cl.card_id, cl.label_id FROM card_labels cl JOIN labels l ON l.id = cl.label_id
WHERE cl.card_id = ANY(@ids::uuid[])
ORDER BY lower(l.name);

-- Checklist.

-- name: ListChecklist :many
SELECT * FROM checklist_items WHERE card_id = $1 ORDER BY position, id;

-- name: GetChecklistItem :one
SELECT * FROM checklist_items WHERE id = $1;

-- name: CountChecklist :one
SELECT count(*)::int FROM checklist_items WHERE card_id = $1;

-- name: LastChecklistPosition :one
SELECT COALESCE(max(position), '')::text FROM checklist_items WHERE card_id = $1;

-- name: NextChecklistPositionAfter :one
SELECT COALESCE(min(position), '')::text FROM checklist_items WHERE card_id = @card_id AND position > @after::text;

-- name: PrevChecklistPositionBefore :one
SELECT COALESCE(max(position), '')::text FROM checklist_items WHERE card_id = @card_id AND position < @before::text;

-- name: CreateChecklistItem :one
INSERT INTO checklist_items (card_id, text, position) VALUES (@card_id, @text, @position) RETURNING *;

-- name: UpdateChecklistItem :one
UPDATE checklist_items SET
    text         = COALESCE(sqlc.narg(text), text),
    done         = COALESCE(sqlc.narg(done), done),
    completed_at = CASE WHEN sqlc.narg(done)::bool IS NULL THEN completed_at
                        WHEN sqlc.narg(done)::bool THEN COALESCE(completed_at, now()) ELSE NULL END,
    position     = COALESCE(sqlc.narg(position), position)
WHERE id = @id
RETURNING *;

-- name: DeleteChecklistItem :exec
DELETE FROM checklist_items WHERE id = $1;

-- name: TransitionsByDay :many
SELECT (at AT TIME ZONE 'UTC')::date AS day, to_status, count(*)::int AS n
FROM card_transitions
WHERE workspace_id = @workspace_id AND at >= @since
GROUP BY 1, 2
ORDER BY 1;

-- name: RecentTransitions :many
SELECT t.id, t.card_id, t.project_id, t.from_status, t.to_status, t.actor_id, t.at, c.title, c.number
FROM card_transitions t JOIN cards c ON c.id = t.card_id
WHERE t.workspace_id = $1 AND c.archived_at IS NULL
ORDER BY t.at DESC
LIMIT $2;

-- name: CardKPIs :one
SELECT
    count(*) FILTER (WHERE status <> 'done')::int AS active,
    count(*)::int AS total,
    count(*) FILTER (WHERE status = 'in_review')::int AS in_review,
    count(*) FILTER (WHERE status <> 'done' AND due_date < @today::date)::int AS overdue,
    count(*) FILTER (WHERE completed_at >= @week_start)::int AS done_this_week,
    count(*) FILTER (WHERE completed_at >= @prev_week_start AND completed_at < @week_start)::int AS done_prev_week,
    count(*) FILTER (WHERE created_at >= @week_start)::int AS created_this_week,
    count(*) FILTER (WHERE created_at >= @prev_week_start AND created_at < @week_start)::int AS created_prev_week
FROM cards WHERE workspace_id = @workspace_id AND archived_at IS NULL;

-- name: RelocateArchivedCards :exec
UPDATE cards SET column_id = @to_column WHERE column_id = @from_column AND archived_at IS NOT NULL;
