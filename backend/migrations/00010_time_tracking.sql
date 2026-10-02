-- +goose Up
-- timetracking module: work logged against cards. A running timer has ended_at NULL; `seconds` is
-- stored when it stops. A user can have only one running timer (docs/adr/0013).
CREATE TABLE time_entries (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    started_at   timestamptz NOT NULL,
    ended_at     timestamptz,
    seconds      integer     NOT NULL DEFAULT 0 CHECK (seconds >= 0),
    note         text        NOT NULL DEFAULT '' CHECK (length(note) <= 500),
    manual       boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT time_entries_order CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX time_entries_one_running ON time_entries (user_id) WHERE ended_at IS NULL;
CREATE INDEX time_entries_card_idx ON time_entries (card_id, started_at DESC);
CREATE INDEX time_entries_user_idx ON time_entries (user_id, started_at DESC);

-- +goose Down
DROP TABLE time_entries;
