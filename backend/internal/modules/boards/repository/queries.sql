-- name: CreateBoard :one
INSERT INTO boards (workspace_id, project_id, name) VALUES (@workspace_id, @project_id, @name)
ON CONFLICT (project_id) DO NOTHING
RETURNING *;

-- name: GetBoardByProject :one
SELECT * FROM boards WHERE project_id = $1;

-- name: GetBoard :one
SELECT * FROM boards WHERE id = $1;

-- name: CreateColumn :one
INSERT INTO board_columns (board_id, name, category, position) VALUES (@board_id, @name, @category, @position)
RETURNING *;

-- name: ListColumns :many
SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position;

-- name: GetColumn :one
SELECT c.id, c.board_id, c.name, c.category, c.position, c.wip_limit, b.project_id, b.workspace_id
FROM board_columns c JOIN boards b ON b.id = c.board_id
WHERE c.id = $1;

-- name: FirstColumnByCategory :one
SELECT c.id, c.board_id, c.name, c.category, c.position, c.wip_limit, b.project_id, b.workspace_id
FROM board_columns c JOIN boards b ON b.id = c.board_id
WHERE b.project_id = @project_id AND c.category = @category
ORDER BY c.position
LIMIT 1;

-- name: UpdateColumn :one
UPDATE board_columns SET
    name      = COALESCE(sqlc.narg(name), name),
    wip_limit = CASE WHEN @set_wip::bool THEN sqlc.narg(wip_limit) ELSE wip_limit END
WHERE id = @id
RETURNING *;

-- name: SetColumnPosition :exec
UPDATE board_columns SET position = @position WHERE id = @id;

-- name: DeleteColumn :exec
DELETE FROM board_columns WHERE id = $1;

-- name: CountColumns :one
SELECT count(*)::int AS total, count(*) FILTER (WHERE category = @category)::int AS in_category
FROM board_columns WHERE board_id = @board_id;

-- name: LastColumnInCategory :one
SELECT COALESCE(max(position), '')::text FROM board_columns WHERE board_id = @board_id AND category = @category;

-- name: NextColumnPositionAfter :one
SELECT COALESCE(min(position), '')::text FROM board_columns WHERE board_id = @board_id AND position > @after::text;

-- name: PrevColumnPositionBefore :one
SELECT COALESCE(max(position), '')::text FROM board_columns WHERE board_id = @board_id AND position < @before::text;

-- name: LastColumnPosition :one
SELECT COALESCE(max(position), '')::text FROM board_columns WHERE board_id = $1;

-- Saved views (personal).

-- name: ListViews :many
SELECT * FROM saved_views WHERE workspace_id = @workspace_id AND user_id = @user_id ORDER BY lower(name), id;

-- name: CountViews :one
SELECT count(*)::int FROM saved_views WHERE workspace_id = @workspace_id AND user_id = @user_id;

-- name: GetView :one
SELECT * FROM saved_views WHERE id = $1;

-- name: CreateView :one
INSERT INTO saved_views (workspace_id, user_id, name, config) VALUES (@workspace_id, @user_id, @name, @config)
RETURNING *;

-- name: UpdateView :one
UPDATE saved_views SET name = COALESCE(sqlc.narg(name), name), config = COALESCE(sqlc.narg(config), config)
WHERE id = @id
RETURNING *;

-- name: DeleteView :exec
DELETE FROM saved_views WHERE id = $1;

-- name: OtherColumnInCategory :one
SELECT id FROM board_columns WHERE board_id = @board_id AND category = @category AND id <> @exclude
ORDER BY position LIMIT 1;
