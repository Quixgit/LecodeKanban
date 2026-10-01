-- name: ListAttachments :many
SELECT * FROM attachments WHERE card_id = $1 ORDER BY created_at, id;

-- name: GetAttachment :one
SELECT * FROM attachments WHERE id = $1;

-- name: CreateAttachment :one
INSERT INTO attachments (workspace_id, card_id, name, content_type, size_bytes, storage_key, uploaded_by)
VALUES (@workspace_id, @card_id, @name, @content_type, @size_bytes, @storage_key, @uploaded_by)
RETURNING *;

-- name: DeleteAttachment :exec
DELETE FROM attachments WHERE id = $1;

-- name: CountAttachments :one
SELECT count(*)::int AS n, COALESCE(sum(size_bytes), 0)::bigint AS bytes FROM attachments WHERE card_id = $1;
