-- +goose Up
-- Team chat (owned by the chat module): channels, direct messages, threads, reactions, read state.
CREATE TABLE chat_channels (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    kind            text        NOT NULL CHECK (kind IN ('public', 'private', 'dm')),
    name            text        CHECK (name IS NULL OR name ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
    topic           text        NOT NULL DEFAULT '' CHECK (length(topic) <= 250),
    -- DM channels: the sorted member ids joined by ",", so one conversation maps to one channel.
    dm_key          text,
    created_by      uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_message_at timestamptz,
    archived_at     timestamptz,
    CONSTRAINT chat_channels_kind_shape CHECK (
        (kind = 'dm' AND name IS NULL AND dm_key IS NOT NULL) OR
        (kind <> 'dm' AND name IS NOT NULL AND dm_key IS NULL))
);
CREATE UNIQUE INDEX chat_channels_name_key ON chat_channels (workspace_id, name) WHERE kind <> 'dm';
CREATE UNIQUE INDEX chat_channels_dm_key ON chat_channels (workspace_id, dm_key) WHERE kind = 'dm';

CREATE TABLE chat_members (
    channel_id   uuid        NOT NULL REFERENCES chat_channels (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    last_read_at timestamptz NOT NULL DEFAULT now(),
    muted        boolean     NOT NULL DEFAULT false,
    PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX chat_members_user_idx ON chat_members (user_id);

CREATE TABLE chat_messages (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id    uuid        NOT NULL REFERENCES chat_channels (id) ON DELETE CASCADE,
    author_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    -- Set on replies: the thread's root message. Threads are one level deep.
    parent_id     uuid        REFERENCES chat_messages (id) ON DELETE CASCADE,
    body          text        NOT NULL CHECK (length(body) <= 8000),
    mentions      uuid[]      NOT NULL DEFAULT '{}',
    reply_count   integer     NOT NULL DEFAULT 0,
    last_reply_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    edited_at     timestamptz,
    deleted_at    timestamptz
);
CREATE INDEX chat_messages_channel_idx ON chat_messages (channel_id, created_at DESC, id DESC) WHERE parent_id IS NULL;
CREATE INDEX chat_messages_thread_idx ON chat_messages (parent_id, created_at) WHERE parent_id IS NOT NULL;

CREATE TABLE chat_reactions (
    message_id uuid        NOT NULL REFERENCES chat_messages (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key        text        NOT NULL CHECK (key ~ '^[a-z0-9-]{1,24}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, key)
);

-- +goose Down
DROP TABLE chat_reactions;
DROP TABLE chat_messages;
DROP TABLE chat_members;
DROP TABLE chat_channels;
