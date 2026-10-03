-- chat module queries (sqlc). Threads are one level deep: replies carry parent_id.

-- name: CreateChannel :one
INSERT INTO chat_channels (workspace_id, kind, name, topic, dm_key, created_by, ref_id, feed, feed_project_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetChannel :one
SELECT * FROM chat_channels WHERE id = $1;

-- name: GetDMChannel :one
SELECT * FROM chat_channels WHERE workspace_id = $1 AND kind = 'dm' AND dm_key = $2;

-- name: GetScopeChannel :one
SELECT * FROM chat_channels WHERE kind = $1 AND ref_id = $2;

-- name: UpdateChannel :one
UPDATE chat_channels SET name = $2, topic = $3 WHERE id = $1 RETURNING *;

-- name: SetFeed :one
UPDATE chat_channels SET feed = $2, feed_project_id = $3 WHERE id = $1 RETURNING *;

-- name: ListFeedChannels :many
SELECT * FROM chat_channels
WHERE workspace_id = $1 AND feed AND archived_at IS NULL AND (feed_project_id IS NULL OR feed_project_id = $2);

-- name: InsertEventMessage :one
INSERT INTO chat_messages (channel_id, author_id, body, event)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ArchiveChannel :exec
UPDATE chat_channels SET archived_at = now() WHERE id = $1;

-- name: TouchChannel :exec
UPDATE chat_channels SET last_message_at = $2 WHERE id = $1;

-- name: ListChannelStates :many
SELECT c.id, c.workspace_id, c.kind, c.name, c.topic, c.dm_key, c.feed, c.feed_project_id, c.created_by, c.created_at, c.last_message_at,
       (m.user_id IS NOT NULL)::boolean AS joined,
       COALESCE(m.muted, false)::boolean AS muted,
       (st.user_id IS NOT NULL)::boolean AS starred,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.parent_id IS NULL AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid)::int AS unread,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid
           AND (sqlc.arg('user_id')::uuid = ANY (x.mentions) OR x.mention_all))::int AS mentions
FROM chat_channels c
LEFT JOIN chat_members m ON m.channel_id = c.id AND m.user_id = sqlc.arg('user_id')
LEFT JOIN chat_stars st ON st.channel_id = c.id AND st.user_id = sqlc.arg('user_id')
WHERE c.workspace_id = sqlc.arg('workspace_id') AND c.archived_at IS NULL
  AND c.kind IN ('public', 'private', 'dm')
  AND (c.kind = 'public' OR m.user_id IS NOT NULL)
ORDER BY c.name NULLS LAST, c.last_message_at DESC NULLS LAST, c.id;

-- name: GetChannelState :one
SELECT c.id, c.workspace_id, c.kind, c.name, c.topic, c.dm_key, c.ref_id, c.feed, c.feed_project_id, c.created_by, c.created_at, c.last_message_at,
       (m.user_id IS NOT NULL)::boolean AS joined,
       COALESCE(m.muted, false)::boolean AS muted,
       (st.user_id IS NOT NULL)::boolean AS starred,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.parent_id IS NULL AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid)::int AS unread,
       (SELECT count(*) FROM chat_messages x
         WHERE x.channel_id = c.id AND x.deleted_at IS NULL
           AND m.user_id IS NOT NULL AND x.created_at > m.last_read_at
           AND x.author_id IS DISTINCT FROM sqlc.arg('user_id')::uuid
           AND (sqlc.arg('user_id')::uuid = ANY (x.mentions) OR x.mention_all))::int AS mentions
FROM chat_channels c
LEFT JOIN chat_members m ON m.channel_id = c.id AND m.user_id = sqlc.arg('user_id')
LEFT JOIN chat_stars st ON st.channel_id = c.id AND st.user_id = sqlc.arg('user_id')
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
INSERT INTO chat_messages (channel_id, author_id, parent_id, body, mentions, mention_all)
VALUES ($1, $2, $3, $4, $5, $6)
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
UPDATE chat_messages SET body = $2, mentions = $3, mention_all = $4, edited_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteMessage :one
UPDATE chat_messages SET body = '', mentions = '{}', mention_all = false, deleted_at = now() WHERE id = $1 RETURNING *;

-- name: AddReaction :exec
INSERT INTO chat_reactions (message_id, user_id, key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: RemoveReaction :exec
DELETE FROM chat_reactions WHERE message_id = $1 AND user_id = $2 AND key = $3;

-- name: ListReactions :many
SELECT * FROM chat_reactions WHERE message_id = ANY (sqlc.arg('ids')::uuid[]) ORDER BY message_id, created_at, user_id;

-- name: CreateFile :one
INSERT INTO chat_files (workspace_id, channel_id, uploaded_by, name, content_type, size, storage_key)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetFile :one
SELECT * FROM chat_files WHERE id = $1;

-- name: AttachFiles :many
UPDATE chat_files SET message_id = sqlc.arg('message_id')
WHERE id = ANY (sqlc.arg('ids')::uuid[]) AND channel_id = sqlc.arg('channel_id')
  AND uploaded_by = sqlc.arg('user_id') AND message_id IS NULL
RETURNING id;

-- name: ListFilesByMessages :many
SELECT * FROM chat_files WHERE message_id = ANY (sqlc.arg('ids')::uuid[]) ORDER BY created_at, id;

-- name: ListChannelFiles :many
SELECT f.* FROM chat_files f
JOIN chat_messages m ON m.id = f.message_id AND m.deleted_at IS NULL
WHERE f.channel_id = $1
ORDER BY f.created_at DESC, f.id DESC
LIMIT $2;

-- name: Star :exec
INSERT INTO chat_stars (user_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: Unstar :exec
DELETE FROM chat_stars WHERE user_id = $1 AND channel_id = $2;

-- name: Save :exec
INSERT INTO chat_saved (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: Unsave :exec
DELETE FROM chat_saved WHERE user_id = $1 AND message_id = $2;

-- name: ListSavedFlags :many
SELECT message_id FROM chat_saved WHERE user_id = $1 AND message_id = ANY (sqlc.arg('ids')::uuid[]);

-- name: Pin :exec
INSERT INTO chat_pins (message_id, channel_id, pinned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING;

-- name: Unpin :exec
DELETE FROM chat_pins WHERE message_id = $1;

-- name: ListPinnedFlags :many
SELECT message_id FROM chat_pins WHERE message_id = ANY (sqlc.arg('ids')::uuid[]);

-- name: ListPinnedMessages :many
SELECT m.* FROM chat_pins p JOIN chat_messages m ON m.id = p.message_id
WHERE p.channel_id = $1 AND m.deleted_at IS NULL
ORDER BY p.pinned_at DESC;

-- name: ListReplyAuthors :many
SELECT parent_id, author_id, max(created_at)::timestamptz AS last_at
FROM chat_messages
WHERE parent_id = ANY (sqlc.arg('ids')::uuid[]) AND deleted_at IS NULL AND author_id IS NOT NULL
GROUP BY parent_id, author_id
ORDER BY parent_id, last_at DESC;

-- name: ListSavedMessages :many
SELECT m.* FROM chat_saved s
JOIN chat_messages m ON m.id = s.message_id AND m.deleted_at IS NULL
JOIN chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL AND c.workspace_id = sqlc.arg('workspace_id')
LEFT JOIN chat_members cm ON cm.channel_id = c.id AND cm.user_id = sqlc.arg('user_id')
WHERE s.user_id = sqlc.arg('user_id')
  AND (c.kind IN ('public', 'project', 'card') OR cm.user_id IS NOT NULL)
ORDER BY s.created_at DESC
LIMIT sqlc.arg('lim');

-- name: ListMyThreads :many
SELECT m.* FROM chat_messages m
JOIN chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL AND c.workspace_id = sqlc.arg('workspace_id')
LEFT JOIN chat_members cm ON cm.channel_id = c.id AND cm.user_id = sqlc.arg('user_id')
WHERE m.parent_id IS NULL AND m.reply_count > 0 AND m.deleted_at IS NULL
  AND (c.kind IN ('public', 'project', 'card') OR cm.user_id IS NOT NULL)
  AND (m.author_id = sqlc.arg('user_id') OR EXISTS (
        SELECT 1 FROM chat_messages r WHERE r.parent_id = m.id AND r.author_id = sqlc.arg('user_id') AND r.deleted_at IS NULL))
ORDER BY m.last_reply_at DESC NULLS LAST
LIMIT sqlc.arg('lim');

-- name: SearchMessages :many
SELECT m.* FROM chat_messages m
JOIN chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL AND c.workspace_id = sqlc.arg('workspace_id')
LEFT JOIN chat_members cm ON cm.channel_id = c.id AND cm.user_id = sqlc.arg('user_id')
WHERE m.deleted_at IS NULL
  AND (sqlc.arg('q')::text = '' OR m.body ILIKE '%' || sqlc.arg('q')::text || '%' ESCAPE '\')
  AND (c.kind IN ('public', 'project', 'card') OR cm.user_id IS NOT NULL)
  AND (sqlc.narg('channel_id')::uuid IS NULL OR m.channel_id = sqlc.narg('channel_id'))
  AND (sqlc.narg('from_id')::uuid IS NULL OR m.author_id = sqlc.narg('from_id'))
  AND (NOT sqlc.arg('mentions_me')::boolean OR sqlc.arg('user_id')::uuid = ANY (m.mentions) OR m.mention_all)
  AND (NOT sqlc.arg('has_link')::boolean OR m.body ~* 'https?://')
  AND (NOT sqlc.arg('has_file')::boolean OR EXISTS (SELECT 1 FROM chat_files f WHERE f.message_id = m.id))
  AND (NOT sqlc.arg('threads_only')::boolean OR m.parent_id IS NOT NULL OR m.reply_count > 0)
  AND (sqlc.narg('after')::timestamptz IS NULL OR m.created_at >= sqlc.narg('after'))
  AND (sqlc.narg('before')::timestamptz IS NULL OR m.created_at < sqlc.narg('before'))
ORDER BY m.created_at DESC
LIMIT sqlc.arg('lim');

-- name: TouchPresence :exec
INSERT INTO chat_presence (user_id, seen_at) VALUES ($1, now())
ON CONFLICT (user_id) DO UPDATE SET seen_at = now();

-- name: OnlineMembers :many
SELECT p.user_id FROM chat_presence p
JOIN workspace_members wm ON wm.user_id = p.user_id AND wm.workspace_id = $1
WHERE p.seen_at > now() - interval '2 minutes';

-- name: UpsertStatus :exec
INSERT INTO chat_status (user_id, kind, icon, text, until, updated_at)
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (user_id) DO UPDATE
SET kind = EXCLUDED.kind, icon = EXCLUDED.icon, text = EXCLUDED.text, until = EXCLUDED.until, updated_at = now();

-- name: DeleteStatus :exec
DELETE FROM chat_status WHERE user_id = $1;

-- name: ListStatuses :many
SELECT s.* FROM chat_status s
JOIN workspace_members wm ON wm.user_id = s.user_id AND wm.workspace_id = $1
WHERE s.until IS NULL OR s.until > now();
