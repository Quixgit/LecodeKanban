-- +goose Up
-- wiki content (W3): page documents, page properties, project links, custom templates and files.

-- The editor document is ProseMirror JSON (TipTap). `plain` is the extracted text used for search
-- and export. `version` makes autosave optimistic: a stale writer gets a conflict, not an overwrite.
CREATE TABLE wiki_contents (
    node_id    uuid PRIMARY KEY REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    doc        jsonb       NOT NULL,
    plain      text        NOT NULL DEFAULT '',
    version    integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_by uuid        REFERENCES users (id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wiki_nodes
    ADD COLUMN status           text    NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'outdated')),
    ADD COLUMN tags             text[]  NOT NULL DEFAULT '{}',
    ADD COLUMN last_verified_at timestamptz,
    -- Days after which a page needs a fresh look; 0 turns the reminder off.
    ADD COLUMN review_days      integer NOT NULL DEFAULT 90 CHECK (review_days BETWEEN 0 AND 730),
    ADD COLUMN full_width       boolean NOT NULL DEFAULT false;

CREATE TABLE wiki_node_projects (
    node_id    uuid NOT NULL REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    PRIMARY KEY (node_id, project_id)
);
CREATE INDEX wiki_node_projects_project_idx ON wiki_node_projects (project_id);

-- Custom templates made by workspace admins; the built-in ones live in code (uk and en).
CREATE TABLE wiki_templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    description  text        NOT NULL DEFAULT '' CHECK (length(description) <= 300),
    icon         text        NOT NULL DEFAULT '' CHECK (length(icon) <= 40),
    doc          jsonb       NOT NULL,
    created_by   uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_templates_workspace_idx ON wiki_templates (workspace_id, lower(name));

-- Files embedded in pages (images, attachments). Access follows the page they were added to.
CREATE TABLE wiki_files (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    node_id      uuid        NOT NULL REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
    content_type text        NOT NULL,
    size         bigint      NOT NULL CHECK (size >= 0),
    storage_key  text        NOT NULL,
    uploaded_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_files_node_idx ON wiki_files (node_id);

-- +goose Down
DROP TABLE wiki_files;
DROP TABLE wiki_templates;
DROP TABLE wiki_node_projects;
ALTER TABLE wiki_nodes
    DROP COLUMN full_width,
    DROP COLUMN review_days,
    DROP COLUMN last_verified_at,
    DROP COLUMN tags,
    DROP COLUMN status;
DROP TABLE wiki_contents;
