-- +goose Up
-- Conversations attached to a project or a card: one channel per target, created on first use.
ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_kind_check;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_kind_check CHECK (kind IN ('public', 'private', 'dm', 'project', 'card'));
ALTER TABLE chat_channels ADD COLUMN ref_id uuid;
ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_kind_shape;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_kind_shape CHECK (
    (kind = 'dm' AND name IS NULL AND dm_key IS NOT NULL AND ref_id IS NULL) OR
    (kind IN ('public', 'private') AND name IS NOT NULL AND dm_key IS NULL AND ref_id IS NULL) OR
    (kind IN ('project', 'card') AND name IS NULL AND dm_key IS NULL AND ref_id IS NOT NULL));
CREATE UNIQUE INDEX chat_channels_ref_key ON chat_channels (kind, ref_id) WHERE ref_id IS NOT NULL;

-- +goose Down
DROP INDEX chat_channels_ref_key;
DELETE FROM chat_channels WHERE kind IN ('project', 'card');
ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_kind_shape;
ALTER TABLE chat_channels DROP COLUMN ref_id;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_kind_shape CHECK (
    (kind = 'dm' AND name IS NULL AND dm_key IS NOT NULL) OR
    (kind <> 'dm' AND name IS NOT NULL AND dm_key IS NULL));
ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_kind_check;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_kind_check CHECK (kind IN ('public', 'private', 'dm'));
