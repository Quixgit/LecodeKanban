-- +goose Up
-- Reactions may be any emoji (validated by the service), not only the built-in icon keys.
ALTER TABLE chat_reactions DROP CONSTRAINT chat_reactions_key_check;
ALTER TABLE chat_reactions ADD CONSTRAINT chat_reactions_key_check CHECK (length(key) BETWEEN 1 AND 32);

-- +goose Down
DELETE FROM chat_reactions WHERE key !~ '^[a-z0-9-]{1,24}$';
ALTER TABLE chat_reactions DROP CONSTRAINT chat_reactions_key_check;
ALTER TABLE chat_reactions ADD CONSTRAINT chat_reactions_key_check CHECK (key ~ '^[a-z0-9-]{1,24}$');
