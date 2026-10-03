-- chat module queries (sqlc). Threads are one level deep: replies carry parent_id.

-- name: CreateChannel :one
INSERT INTO chat_channels (workspace_id, kind, name, topic, dm_key, created_by, ref_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetChannel :one
SELECT * FROM chat_channels WHERE id = $1;

-- name: GetDMChannel :one
SELECT * FROM chat_channels WHERE workspace_id = $1 AND kind = 'dm' AND dm_key = $2;

-- name: GetScopeChannel :one
SELECT * FROM chat_channels WHERE kind = $1 AND ref_id = $2;

-- name: UpdateChannel :one
UPDATE chat_channels SET name = $2, topic = $3 WHERE id = $1 RETURNING *;

-- name: ArchiveChannel :exec
UPDATE chat_channels SET archived_at = now() WHERE id = $1;

-- name: TouchChannel :exec
UPDATE chat_channels SET last_message_at = $2 WHERE id = $1;

-- name: ListChannelStates :many
SELECT c.id, c.workspace_id, c.kind, c.name, c.topic, c.dm_key, c.created_by, c.created_at, c.last_message_at,
       (m.user_id IS NOT NULL)::boolean AS joined,
       COALESCE(m.muted, false)::boolean AS muted,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.parent_id IS NULL AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid)::int AS unread,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid
           AND sqlc.arg('user_id')::uuid = ANY (x.mentions))::int AS mentions
FROM chat_channels c
LEFT JOIN chat_members m ON m.channel_id = c.id AND m.user_id = sqlc.arg('user_id')
WHERE c.workspace_id = sqlc.arg('workspace_id') AND c.archived_at IS NULL
  AND c.kind IN ('public', 'private', 'dm')
  AND (c.kind = 'public' OR m.user_id IS NOT NULL)
ORDER BY c.name NULLS LAST, c.last_message_at DESC NULLS LAST, c.id;

-- name: GetChannelState :one
SELECT c.id, c.workspace_id, c.kind, c.name, c.topic, c.dm_key, c.ref_id, c.created_by, c.created_at, c.last_message_at,
       (m.user_id IS NOT NULL)::boolean AS joined,
       COALESCE(m.muted, false)::boolean AS muted,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.parent_id IS NULL AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid)::int AS unread,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid
           AND sqlc.arg('user_id')::uuid = ANY (x.mentions))::int AS mentions
FROM chat_channels c
LEFT JOIN chat_members m ON m.channel_id = c.id AND m.user_id = sqlc.arg('user_id')
WHERE c.id = sqlc.arg('id');

-- name: AddMember :exec
INSERT INTO chat_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: RemoveMember :exec
DELETE FROM chat_members WHERE channel_id = $1 AND user_id = $2;

-- name: GetMembership :one
SELECT * FROM chat_members WHERE channel_id = $1 AND user_id = $2;

-- name: ListMembers :many
SELECT * FROM chat_members WHERE channel_id = $1 ORDER BY joined_at, user_id;

-- name: ListMembersOf :many
SELECT * FROM chat_members WHERE channel_id = ANY (sqlc.arg('ids')::uuid[]) ORDER BY channel_id, joined_at, user_id;

-- name: MarkRead :exec
UPDATE chat_members SET last_read_at = now() WHERE channel_id = $1 AND user_id = $2;

-- name: SetMuted :exec
UPDATE chat_members SET muted = $3 WHERE channel_id = $1 AND user_id = $2;

-- name: InsertMessage :one
INSERT INTO chat_messages (channel_id, author_id, parent_id, body, mentions)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetMessage :one
SELECT * FROM chat_messages WHERE id = $1;

-- name: ListMessages :many
SELECT * FROM chat_messages m
WHERE m.channel_id = sqlc.arg('channel_id') AND m.parent_id IS NULL
  AND (sqlc.narg('before_id')::uuid IS NULL
       OR m.created_at < (SELECT b.created_at FROM chat_messages b WHERE b.id = sqlc.narg('before_id'))
       OR (m.created_at = (SELECT b.created_at FROM chat_messages b WHERE b.id = sqlc.narg('before_id'))
           AND m.id < sqlc.narg('before_id')))
ORDER BY m.created_at DESC, m.id DESC
LIMIT sqlc.arg('lim');

-- name: ListReplies :many
SELECT * FROM chat_messages WHERE parent_id = $1 ORDER BY created_at, id;

-- name: AddReply :exec
UPDATE chat_messages SET reply_count = reply_count + 1, last_reply_at = $2 WHERE id = $1;

-- name: RemoveReply :exec
UPDATE chat_messages SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1;

-- name: UpdateMessage :one
UPDATE chat_messages SET body = $2, mentions = $3, edited_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteMessage :one
UPDATE chat_messages SET body = '', mentions = '{}', deleted_at = now() WHERE id = $1 RETURNING *;

-- name: AddReaction :exec
INSERT INTO chat_reactions (message_id, user_id, key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: RemoveReaction :exec
DELETE FROM chat_reactions WHERE message_id = $1 AND user_id = $2 AND key = $3;

-- name: ListReactions :many
SELECT * FROM chat_reactions WHERE message_id = ANY (sqlc.arg('ids')::uuid[]) ORDER BY message_id, created_at, user_id;
