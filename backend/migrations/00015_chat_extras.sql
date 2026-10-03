-- +goose Up
-- Attachments, @channel / @here, starred channels, saved ("Later") messages, pins, presence and search.
ALTER TABLE chat_messages ADD COLUMN mention_all boolean NOT NULL DEFAULT false;
CREATE INDEX chat_messages_body_trgm ON chat_messages USING gin (body gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE TABLE chat_files (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    channel_id   uuid        NOT NULL REFERENCES chat_channels (id) ON DELETE CASCADE,
    -- Null until the message that carries the file is sent.
    message_id   uuid        REFERENCES chat_messages (id) ON DELETE CASCADE,
    uploaded_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
    content_type text        NOT NULL,
    size         bigint      NOT NULL CHECK (size >= 0),
    storage_key  text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_files_message_idx ON chat_files (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX chat_files_channel_idx ON chat_files (channel_id, created_at DESC) WHERE message_id IS NOT NULL;

CREATE TABLE chat_stars (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    channel_id uuid        NOT NULL REFERENCES chat_channels (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE chat_saved (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message_id uuid        NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, message_id)
);
CREATE INDEX chat_saved_user_idx ON chat_saved (user_id, created_at DESC);

CREATE TABLE chat_pins (
    message_id uuid PRIMARY KEY REFERENCES chat_messages (id) ON DELETE CASCADE,
    channel_id uuid        NOT NULL REFERENCES chat_channels (id) ON DELETE CASCADE,
    pinned_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
    pinned_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_pins_channel_idx ON chat_pins (channel_id, pinned_at DESC);

-- Heartbeat of people with the app open; "online" means seen in the last couple of minutes.
CREATE TABLE chat_presence (
    user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    seen_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE chat_presence;
DROP TABLE chat_pins;
DROP TABLE chat_saved;
DROP TABLE chat_stars;
DROP TABLE chat_files;
DROP INDEX chat_messages_body_trgm;
ALTER TABLE chat_messages DROP COLUMN mention_all;
