-- name: ListTimeEntries :many
SELECT * FROM time_entries WHERE card_id = $1 ORDER BY started_at DESC, id;

-- name: GetTimeEntry :one
SELECT * FROM time_entries WHERE id = $1;

-- name: RunningTimer :one
SELECT * FROM time_entries WHERE user_id = $1 AND ended_at IS NULL;

-- name: StartTimer :one
INSERT INTO time_entries (workspace_id, card_id, user_id, started_at)
VALUES (@workspace_id, @card_id, @user_id, @started_at)
RETURNING *;

-- name: StopTimer :one
UPDATE time_entries SET
    ended_at = sqlc.arg(ended_at),
    seconds  = GREATEST(EXTRACT(EPOCH FROM (sqlc.arg(ended_at)::timestamptz - started_at))::int, 0)
WHERE id = @id AND ended_at IS NULL
RETURNING *;

-- name: StopRunningTimer :exec
UPDATE time_entries SET
    ended_at = sqlc.arg(ended_at),
    seconds  = GREATEST(EXTRACT(EPOCH FROM (sqlc.arg(ended_at)::timestamptz - started_at))::int, 0)
WHERE user_id = @user_id AND ended_at IS NULL;

-- name: LogTime :one
INSERT INTO time_entries (workspace_id, card_id, user_id, started_at, ended_at, seconds, note, manual)
VALUES (@workspace_id, @card_id, @user_id, @started_at, @ended_at, @seconds, @note, true)
RETURNING *;

-- name: DeleteTimeEntry :exec
DELETE FROM time_entries WHERE id = $1;
