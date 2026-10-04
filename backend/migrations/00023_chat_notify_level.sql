-- +goose Up
-- How a member wants to hear about a channel: everything (default), only mentions (muted = false,
-- mentions_only = true), or nothing (muted = true). Muted stays the column for "nothing".
ALTER TABLE chat_members ADD COLUMN mentions_only boolean NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE chat_members DROP COLUMN mentions_only;
