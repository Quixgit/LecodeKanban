-- +goose Up
CREATE TABLE workspace_roles (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         text NOT NULL,
    description  text NOT NULL DEFAULT '',
    -- The built-in role this one ranks as: it decides who may change whom.
    base         text NOT NULL CHECK (base IN ('admin', 'member', 'viewer')),
    permissions  text[] NOT NULL DEFAULT '{}',
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX workspace_roles_name_idx ON workspace_roles (workspace_id, lower(name));

-- A workspace may change what a built-in role can do.
CREATE TABLE workspace_role_overrides (
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    role         text NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
    permissions  text[] NOT NULL,
    PRIMARY KEY (workspace_id, role)
);

ALTER TABLE workspace_members ADD COLUMN custom_role_id uuid REFERENCES workspace_roles (id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE workspace_members DROP COLUMN custom_role_id;
DROP TABLE workspace_role_overrides;
DROP TABLE workspace_roles;
