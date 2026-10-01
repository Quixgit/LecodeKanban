-- name: InsertActivity :exec
INSERT INTO activity (workspace_id, project_id, card_id, actor_id, kind, data)
VALUES (@workspace_id, sqlc.narg(project_id), sqlc.narg(card_id), sqlc.narg(actor_id), @kind, @data);

-- name: CardActivity :many
SELECT * FROM activity
WHERE card_id = @card_id AND (sqlc.narg(before)::bigint IS NULL OR id < sqlc.narg(before)::bigint)
ORDER BY id DESC
LIMIT @lim;
