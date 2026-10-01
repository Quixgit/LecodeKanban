-- +goose Up
CREATE TABLE workspaces (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    slug       text        NOT NULL,
    created_by uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workspaces_slug_key UNIQUE (slug)
);
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE workspace_members (
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role         text        NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE workspace_invites (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    email        citext      NOT NULL,
    role         text        NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    token_hash   bytea       NOT NULL UNIQUE,
    invited_by   uuid        REFERENCES users (id) ON DELETE SET NULL,
    expires_at   timestamptz NOT NULL,
    accepted_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
-- At most one open invite per email per workspace.
CREATE UNIQUE INDEX workspace_invites_open_key ON workspace_invites (workspace_id, email) WHERE accepted_at IS NULL;

-- +goose Down
DROP TABLE workspace_invites;
DROP TABLE workspace_members;
DROP TABLE workspaces;
