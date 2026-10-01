-- +goose Up
-- One row per issued refresh token. Tokens of a login session share family_id;
-- presenting a rotated (already replaced) token revokes the whole family.
CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   uuid        NOT NULL,
    token_hash  bytea       NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid REFERENCES refresh_tokens (id) ON DELETE SET NULL,
    user_agent  text,
    ip          text,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);

-- Single-use emailed tokens (verification, password reset).
CREATE TABLE user_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    text        NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash bytea       NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_tokens_user_purpose_idx ON user_tokens (user_id, purpose);

-- External identities (Google, GitHub) linked to a user.
CREATE TABLE user_identities (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         text        NOT NULL CHECK (provider IN ('google', 'github')),
    provider_user_id text        NOT NULL,
    email            citext,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_identities_provider_uid_key UNIQUE (provider, provider_user_id)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);

-- +goose Down
DROP TABLE user_identities;
DROP TABLE user_tokens;
DROP TABLE refresh_tokens;
