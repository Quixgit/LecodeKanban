-- +goose Up
CREATE TABLE jobs (
    id              bigserial PRIMARY KEY,
    kind            text        NOT NULL,
    payload         jsonb       NOT NULL DEFAULT '{}',
    status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
    attempts        integer     NOT NULL DEFAULT 0,
    max_attempts    integer     NOT NULL DEFAULT 8,
    run_at          timestamptz NOT NULL DEFAULT now(),
    locked_until    timestamptz,
    locked_by       text,
    last_error      text,
    idempotency_key text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz
);
CREATE INDEX jobs_ready_idx ON jobs (run_at) WHERE status = 'pending';
CREATE INDEX jobs_stale_idx ON jobs (locked_until) WHERE status = 'running';
CREATE UNIQUE INDEX jobs_idempotency_key ON jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- +goose Down
DROP TABLE jobs;
