-- +goose Up
-- Requests to the people who run a workspace: a problem, an idea or a question, optionally with a screenshot.
-- The screenshot (a small image) lives in the row: there is at most one per request and it is bounded.
CREATE TABLE support_requests (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    author_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind             text NOT NULL CHECK (kind IN ('problem', 'idea', 'question')),
    subject          text NOT NULL CHECK (length(subject) BETWEEN 1 AND 120),
    message          text NOT NULL CHECK (length(message) BETWEEN 1 AND 5000),
    page_url         text NOT NULL DEFAULT '' CHECK (length(page_url) <= 500),
    user_agent       text NOT NULL DEFAULT '' CHECK (length(user_agent) <= 300),
    screenshot       bytea,
    screenshot_type  text,
    status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    resolved_at      timestamptz
);
CREATE INDEX support_requests_ws_idx ON support_requests (workspace_id, status, created_at DESC);
CREATE INDEX support_requests_author_idx ON support_requests (author_id, created_at DESC);

-- +goose Down
DROP TABLE support_requests;
