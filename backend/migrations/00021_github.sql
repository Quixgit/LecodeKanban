-- +goose Up
-- GitHub, connected once per workspace by an administrator with an access token (sealed with the
-- encryption key). Projects are linked to repositories; pull requests and issues that mention task keys
-- become links on the cards, and the two sides keep each other in step.
CREATE TABLE github_connections (
    workspace_id          uuid PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
    connected_by          uuid        NOT NULL REFERENCES users (id),
    account_login         text        NOT NULL,
    token_enc             bytea       NOT NULL,
    webhook_secret_enc    bytea       NOT NULL,
    enabled               boolean     NOT NULL DEFAULT true,
    -- Rules: what GitHub activity does to cards, and what card changes do on GitHub.
    pr_opened_to_review   boolean     NOT NULL DEFAULT true,
    pr_merged_to_done     boolean     NOT NULL DEFAULT true,
    sync_issues           boolean     NOT NULL DEFAULT true,
    comment_on_pr         boolean     NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE github_repos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES github_connections (workspace_id) ON DELETE CASCADE,
    project_id   uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    full_name    text        NOT NULL CHECK (full_name ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
    hook_id      bigint,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id),
    UNIQUE (workspace_id, full_name)
);

CREATE TABLE github_links (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    repo_id      uuid        NOT NULL REFERENCES github_repos (id) ON DELETE CASCADE,
    kind         text        NOT NULL CHECK (kind IN ('pr', 'issue')),
    number       int         NOT NULL,
    title        text        NOT NULL,
    state        text        NOT NULL CHECK (state IN ('open', 'draft', 'merged', 'closed')),
    url          text        NOT NULL,
    author       text        NOT NULL DEFAULT '',
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (repo_id, kind, number, card_id)
);
CREATE INDEX github_links_card_idx ON github_links (card_id);
CREATE INDEX github_links_ref_idx ON github_links (repo_id, kind, number);

-- Deliveries already handled (GitHub redelivers); old rows are pruned by the handler.
CREATE TABLE github_deliveries (
    delivery_id text PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE github_deliveries;
DROP TABLE github_links;
DROP TABLE github_repos;
DROP TABLE github_connections;
