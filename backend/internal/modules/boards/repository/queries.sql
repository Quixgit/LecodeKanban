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
