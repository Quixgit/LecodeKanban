-- name: CreateProject :one
INSERT INTO projects (workspace_id, key, name, description, status, pic_user_id, team, icon, tone, start_date, deadline, created_by)
VALUES (@workspace_id, @key, @name, @description, @status, sqlc.narg(pic_user_id), sqlc.narg(team), @icon, @tone,
        sqlc.narg(start_date), sqlc.narg(deadline), @created_by)
RETURNING *;

-- name: GetProject :one
SELECT * FROM projects WHERE id = $1 AND archived_at IS NULL;

-- name: UpdateProject :one
UPDATE projects SET
    name        = COALESCE(sqlc.narg(name), name),
    description = COALESCE(sqlc.narg(description), description),
    status      = COALESCE(sqlc.narg(status), status),
    icon        = COALESCE(sqlc.narg(icon), icon),
    tone        = COALESCE(sqlc.narg(tone), tone),
    pic_user_id = CASE WHEN @set_pic::bool THEN sqlc.narg(pic_user_id) ELSE pic_user_id END,
    team        = CASE WHEN @set_team::bool THEN sqlc.narg(team) ELSE team END,
    start_date  = CASE WHEN @set_start::bool THEN sqlc.narg(start_date) ELSE start_date END,
    deadline    = CASE WHEN @set_deadline::bool THEN sqlc.narg(deadline) ELSE deadline END
WHERE id = @id AND archived_at IS NULL
RETURNING *;

-- name: ArchiveProject :exec
UPDATE projects SET archived_at = now() WHERE id = $1 AND archived_at IS NULL;

-- name: SetProjectCounts :exec
UPDATE projects SET task_count = @task_count, done_count = @done_count WHERE id = @id;

-- name: ProjectSummary :one
SELECT count(*)::int AS total,
       count(*) FILTER (WHERE status = 'completed')::int AS completed,
       count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       count(*) FILTER (WHERE status = 'pending')::int AS pending,
       count(*) FILTER (WHERE status <> 'completed' AND deadline < @today::date)::int AS overdue
FROM projects WHERE workspace_id = @workspace_id AND archived_at IS NULL;

-- name: DistinctTeams :many
SELECT DISTINCT team::text FROM projects
WHERE workspace_id = $1 AND archived_at IS NULL AND team IS NOT NULL
ORDER BY 1;

-- name: ProjectsByIDs :many
SELECT id, workspace_id, key, name, icon, tone FROM projects WHERE id = ANY(@ids::uuid[]);
