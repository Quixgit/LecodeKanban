-- +goose Up
-- wiki module (docs/adr/0014): spaces, a tree of folders and pages, per-element visibility and
-- grants, trash, favorites, recents and an audit log. Page content, versions and comments arrive
-- in later phases and reference wiki_nodes.

CREATE TABLE wiki_spaces (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    owner_id       uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name           text        NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    icon           text        NOT NULL DEFAULT '' CHECK (length(icon) <= 40),
    color          text        NOT NULL DEFAULT '' CHECK (length(color) <= 20),
    description    text        NOT NULL DEFAULT '' CHECK (length(description) <= 500),
    -- Space-level visibility is always explicit; nodes may inherit (NULL).
    visibility     text        NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'workspace')),
    -- What "workspace" visibility allows everybody in the workspace to do.
    workspace_role text        NOT NULL DEFAULT 'viewer' CHECK (workspace_role IN ('viewer', 'commenter', 'editor')),
    max_depth      smallint    NOT NULL DEFAULT 12 CHECK (max_depth BETWEEN 2 AND 32),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_spaces_workspace_idx ON wiki_spaces (workspace_id);

CREATE TABLE wiki_nodes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    space_id       uuid        NOT NULL REFERENCES wiki_spaces (id) ON DELETE CASCADE,
    -- SET NULL: purging a trashed parent keeps independently trashed children restorable (at the root).
    parent_id      uuid        REFERENCES wiki_nodes (id) ON DELETE SET NULL,
    kind           text        NOT NULL CHECK (kind IN ('folder', 'page')),
    title          text        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    icon           text        NOT NULL DEFAULT '' CHECK (length(icon) <= 40),
    cover          text        NOT NULL DEFAULT '' CHECK (length(cover) <= 200),
    rank           text        NOT NULL,
    depth          smallint    NOT NULL CHECK (depth >= 1),
    -- Materialised path "/<root id>/<…>/<own id>/": subtree = path LIKE prefix || '%'.
    path           text        NOT NULL,
    -- NULL = inherit from the parent (or the space).
    visibility     text        CHECK (visibility IN ('private', 'shared', 'workspace')),
    workspace_role text        NOT NULL DEFAULT 'viewer' CHECK (workspace_role IN ('viewer', 'commenter', 'editor')),
    owner_id       uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_by     uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    -- Soft delete: the whole subtree gets the same deleted_at and trash_root_id = the deleted node.
    deleted_at     timestamptz,
    deleted_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
    trash_root_id  uuid,
    CONSTRAINT wiki_nodes_trash CHECK ((deleted_at IS NULL) = (trash_root_id IS NULL))
);
CREATE INDEX wiki_nodes_siblings_idx ON wiki_nodes (space_id, parent_id, rank, id) WHERE deleted_at IS NULL;
CREATE INDEX wiki_nodes_path_idx ON wiki_nodes (path text_pattern_ops);
CREATE INDEX wiki_nodes_workspace_idx ON wiki_nodes (workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX wiki_nodes_trash_idx ON wiki_nodes (workspace_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX wiki_nodes_trash_root_idx ON wiki_nodes (trash_root_id) WHERE trash_root_id IS NOT NULL;
CREATE INDEX wiki_nodes_owner_idx ON wiki_nodes (owner_id) WHERE deleted_at IS NULL;

-- Direct grants. node_id NULL = space-level. principal_id of a 'team' has no FK: the product has
-- no teams yet (docs/adr/0014), the Authorizer resolves them through a port.
CREATE TABLE wiki_permissions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    space_id       uuid        NOT NULL REFERENCES wiki_spaces (id) ON DELETE CASCADE,
    node_id        uuid        REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    principal_kind text        NOT NULL CHECK (principal_kind IN ('user', 'team')),
    principal_id   uuid        NOT NULL,
    role           text        NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
    created_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wiki_permissions_unique_idx
    ON wiki_permissions (space_id, COALESCE(node_id, '00000000-0000-0000-0000-000000000000'::uuid), principal_kind, principal_id);
CREATE INDEX wiki_permissions_principal_idx ON wiki_permissions (principal_kind, principal_id);
CREATE INDEX wiki_permissions_node_idx ON wiki_permissions (node_id) WHERE node_id IS NOT NULL;

CREATE TABLE wiki_favorites (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    node_id    uuid        NOT NULL REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, node_id)
);

CREATE TABLE wiki_recents (
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    node_id   uuid        NOT NULL REFERENCES wiki_nodes (id) ON DELETE CASCADE,
    viewed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, node_id)
);
CREATE INDEX wiki_recents_user_idx ON wiki_recents (user_id, viewed_at DESC);

-- Append-only log of share/visibility/move/delete/restore events. No FK to nodes so entries
-- outlive purged pages; titles are stored in data for readability.
CREATE TABLE wiki_audit (
    id           bigserial PRIMARY KEY,
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    space_id     uuid,
    node_id      uuid,
    actor_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    kind         text        NOT NULL,
    data         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wiki_audit_space_idx ON wiki_audit (space_id, id DESC);
CREATE INDEX wiki_audit_node_idx ON wiki_audit (node_id, id DESC) WHERE node_id IS NOT NULL;

-- +goose Down
DROP TABLE wiki_audit;
DROP TABLE wiki_recents;
DROP TABLE wiki_favorites;
DROP TABLE wiki_permissions;
DROP TABLE wiki_nodes;
DROP TABLE wiki_spaces;
