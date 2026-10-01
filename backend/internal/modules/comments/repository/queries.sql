-- name: ListComments :many
SELECT * FROM comments WHERE card_id = $1 ORDER BY created_at, id;

-- name: GetComment :one
SELECT * FROM comments WHERE id = $1;

-- name: CreateComment :one
INSERT INTO comments (workspace_id, card_id, author_id, body) VALUES (@workspace_id, @card_id, @author_id, @body)
RETURNING *;

-- name: UpdateComment :one
UPDATE comments SET body = @body, edited_at = now() WHERE id = @id RETURNING *;

-- name: DeleteComment :exec
DELETE FROM comments WHERE id = $1;

-- name: CountComments :one
SELECT count(*)::int FROM comments WHERE card_id = $1;

-- name: ClearMentions :exec
DELETE FROM comment_mentions WHERE comment_id = $1;

-- name: AddMentions :exec
INSERT INTO comment_mentions (comment_id, user_id)
SELECT @comment_id, unnest(@user_ids::uuid[])
ON CONFLICT DO NOTHING;

-- name: MentionsForComments :many
SELECT comment_id, user_id FROM comment_mentions WHERE comment_id = ANY(@ids::uuid[]);
