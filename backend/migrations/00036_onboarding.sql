-- +goose Up
-- WhatsApp is a contact like Telegram; onboarded_at is when the person finished (or skipped) the welcome wizard.
-- Everybody who exists now has already found their way around: they are marked as done.
ALTER TABLE users
    ADD COLUMN whatsapp     text NOT NULL DEFAULT '',
    ADD COLUMN onboarded_at timestamptz;
UPDATE users SET onboarded_at = now();

-- +goose Down
ALTER TABLE users DROP COLUMN whatsapp, DROP COLUMN onboarded_at;
