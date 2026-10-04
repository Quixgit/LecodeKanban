-- +goose Up
ALTER TABLE chat_members ADD COLUMN muted_until timestamptz;

-- +goose Down
ALTER TABLE chat_members DROP COLUMN muted_until;
