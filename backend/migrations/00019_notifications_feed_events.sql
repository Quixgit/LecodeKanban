-- +goose Up
-- Which task events a feed channel takes: created, assigned (someone newly assigned), moved,
-- updated (other field edits), deleted, commented. Everything by default.
ALTER TABLE chat_channels
    ADD COLUMN feed_events text[] NOT NULL DEFAULT '{created,assigned,moved,updated,deleted,commented}'
    CHECK (feed_events <@ ARRAY['created','assigned','moved','updated','deleted','commented']::text[]);

-- The bell: things that happened to a person (assigned to a task, mentioned, a direct message, an
-- update on a task they work on). Read state is per row.
CREATE TABLE notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    kind         text        NOT NULL CHECK (kind IN ('assigned', 'task_moved', 'task_updated', 'task_commented', 'mention', 'dm')),
    actor_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    card_id      uuid        REFERENCES cards (id) ON DELETE CASCADE,
    project_id   uuid,
    channel_id   uuid        REFERENCES chat_channels (id) ON DELETE CASCADE,
    message_id   uuid,
    title        text        NOT NULL,
    body         text        NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now(),
    read_at      timestamptz
);
CREATE INDEX notifications_user_idx ON notifications (user_id, workspace_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id, workspace_id) WHERE read_at IS NULL;

-- +goose Down
DROP TABLE notifications;
ALTER TABLE chat_channels DROP COLUMN feed_events;
