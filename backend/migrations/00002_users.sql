-- +goose Up
CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email              citext      NOT NULL,
    name               text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    password_hash      text,                         -- NULL for OAuth-only accounts
    email_verified_at  timestamptz,
    locale             text        NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'uk')),
    avatar_url         text,
    failed_login_count integer     NOT NULL DEFAULT 0,
    locked_until       timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_key UNIQUE (email)
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE users;
