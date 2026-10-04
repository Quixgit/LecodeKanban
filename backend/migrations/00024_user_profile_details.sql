-- +goose Up
ALTER TABLE users
    ADD COLUMN job_title text NOT NULL DEFAULT '',
    ADD COLUMN phone     text NOT NULL DEFAULT '',
    ADD COLUMN location  text NOT NULL DEFAULT '',
    ADD COLUMN timezone  text NOT NULL DEFAULT '',
    ADD COLUMN bio       text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE users
    DROP COLUMN job_title, DROP COLUMN phone, DROP COLUMN location, DROP COLUMN timezone, DROP COLUMN bio;
