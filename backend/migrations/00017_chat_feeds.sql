-- +goose Up
-- Task feeds: a channel that receives task updates (created, moved, edited, deleted, commented) as
-- structured messages. Nobody posts at top level there; replies in threads are allowed.
ALTER TABLE chat_channels ADD COLUMN feed boolean NOT NULL DEFAULT false;
-- Null means every project of the workspace. Deliberately not a foreign key: a deleted project simply
-- stops feeding.
ALTER TABLE chat_channels ADD COLUMN feed_project_id uuid;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_feed_kind CHECK (NOT feed OR kind IN ('public', 'private'));
CREATE INDEX chat_channels_feed_idx ON chat_channels (workspace_id) WHERE feed;
ALTER TABLE chat_messages ADD COLUMN event jsonb;

-- +goose Down
ALTER TABLE chat_messages DROP COLUMN event;
DROP INDEX chat_channels_feed_idx;
ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_feed_kind;
ALTER TABLE chat_channels DROP COLUMN feed_project_id;
ALTER TABLE chat_channels DROP COLUMN feed;
