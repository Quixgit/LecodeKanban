-- +goose Up
-- A person's chosen status: how available they are, an optional icon and short text, and when it ends.
-- No row means "available" (shown through presence alone).
CREATE TABLE chat_status (
    user_id    uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    kind       text        NOT NULL CHECK (kind IN ('available', 'busy', 'dnd', 'away')),
    icon       text        CHECK (icon IS NULL OR icon ~ '^[a-z0-9-]{1,24}$'),
    text       text        NOT NULL DEFAULT '' CHECK (length(text) <= 100),
    until      timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE chat_status;
