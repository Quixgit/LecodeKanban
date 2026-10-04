-- +goose Up
ALTER TABLE users
    ADD COLUMN pronouns     text   NOT NULL DEFAULT '',
    ADD COLUMN linkedin     text   NOT NULL DEFAULT '',
    ADD COLUMN telegram     text   NOT NULL DEFAULT '',
    ADD COLUMN website      text   NOT NULL DEFAULT '',
    ADD COLUMN work_start   text   NOT NULL DEFAULT '',
    ADD COLUMN work_end     text   NOT NULL DEFAULT '',
    ADD COLUMN skills       text[] NOT NULL DEFAULT '{}',
    ADD COLUMN cover_preset text   NOT NULL DEFAULT '',
    ADD COLUMN cover_url    text,
    ADD COLUMN cover_key    text,
    ADD COLUMN cover_type   text;

-- +goose Down
ALTER TABLE users
    DROP COLUMN pronouns, DROP COLUMN linkedin, DROP COLUMN telegram, DROP COLUMN website,
    DROP COLUMN work_start, DROP COLUMN work_end, DROP COLUMN skills, DROP COLUMN cover_preset,
    DROP COLUMN cover_url, DROP COLUMN cover_key, DROP COLUMN cover_type;
