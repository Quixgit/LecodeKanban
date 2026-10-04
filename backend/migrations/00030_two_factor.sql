-- +goose Up
CREATE TABLE user_two_factor (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret          bytea   NOT NULL,                -- sealed (AES-GCM), never stored in clear
    enabled         boolean NOT NULL DEFAULT false,  -- false while the user has not confirmed a first code
    last_step       bigint  NOT NULL DEFAULT 0,      -- the last accepted 30-second step: a code works once
    recovery_hashes bytea[] NOT NULL DEFAULT '{}',   -- SHA-256 of the unused one-time recovery codes
    created_at      timestamptz NOT NULL DEFAULT now(),
    enabled_at      timestamptz
);

-- +goose Down
DROP TABLE user_two_factor;
