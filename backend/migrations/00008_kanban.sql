-- +goose Up
-- Phase 4: Kanban — labels, checklists, comments, attachments, activity, saved views and
-- derived progress (docs/adr/0010-derived-progress.md).

-- cards module: counters feeding card badges and derived progress.
ALTER TABLE cards
    ADD COLUMN checklist_total  integer NOT NULL DEFAULT 0,
    ADD COLUMN checklist_done   integer NOT NULL DEFAULT 0,
    ADD COLUMN comment_count    integer NOT NULL DEFAULT 0,
    ADD COLUMN attachment_count integer NOT NULL DEFAULT 0;

-- Progress is derived from workflow stage (no checklist) — recompute existing cards.
UPDATE cards SET progress = CASE status
    WHEN 'done' THEN 100 WHEN 'in_review' THEN 80 WHEN 'in_progress' THEN 40 ELSE 0 END;

-- projects module: average card progress (denormalised like task_count / done_count).
ALTER TABLE projects ADD COLUMN progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100);
UPDATE projects p SET progress = COALESCE((
    SELECT round(avg(c.progress))::smallint FROM cards c WHERE c.project_id = p.id AND c.archived_at IS NULL
), 0);

-- cards module: workspace labels.
CREATE TABLE labels (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
    tone         text        NOT NULL DEFAULT 'teal' CHECK (tone IN ('teal', 'amber', 'purple', 'red', 'neutral')),
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX labels_workspace_name ON labels (workspace_id, lower(name));

CREATE TABLE card_labels (
    card_id  uuid NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    label_id uuid NOT NULL REFERENCES labels (id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);
CREATE INDEX card_labels_label_idx ON card_labels (label_id);

-- cards module: checklist items.
CREATE TABLE checklist_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    text         text        NOT NULL CHECK (length(text) BETWEEN 1 AND 300),
    done         boolean     NOT NULL DEFAULT false,
    position     text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);
CREATE INDEX checklist_items_card_idx ON checklist_items (card_id, position);

-- comments module.
CREATE TABLE comments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    author_id    uuid        REFERENCES users (id) ON DELETE SET NULL,
    body         text        NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
    created_at   timestamptz NOT NULL DEFAULT now(),
    edited_at    timestamptz
);
CREATE INDEX comments_card_idx ON comments (card_id, created_at);

CREATE TABLE comment_mentions (
    comment_id uuid NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX comment_mentions_user_idx ON comment_mentions (user_id);

-- attachments module (file bytes live in the storage backend, keyed by storage_key).
CREATE TABLE attachments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
    content_type text        NOT NULL,
    size_bytes   bigint      NOT NULL CHECK (size_bytes >= 0),
    storage_key  text        NOT NULL UNIQUE,
    uploaded_by  uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_card_idx ON attachments (card_id, created_at);

-- activity module: append-only audit + feed. `data` holds kind-specific details.
CREATE TABLE activity (
    id           bigserial PRIMARY KEY,
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id   uuid        REFERENCES projects (id) ON DELETE CASCADE,
    card_id      uuid        REFERENCES cards (id) ON DELETE CASCADE,
    actor_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    kind         text        NOT NULL,
    data         jsonb       NOT NULL DEFAULT '{}',
    at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_card_idx ON activity (card_id, at DESC) WHERE card_id IS NOT NULL;
CREATE INDEX activity_workspace_idx ON activity (workspace_id, at DESC);

-- boards module: personal saved views (filters, swimlanes, project) per workspace.
CREATE TABLE saved_views (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    config       jsonb       NOT NULL DEFAULT '{}',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_views_owner_idx ON saved_views (workspace_id, user_id);
CREATE TRIGGER saved_views_updated_at BEFORE UPDATE ON saved_views FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE saved_views;
DROP TABLE activity;
DROP TABLE attachments;
DROP TABLE comment_mentions;
DROP TABLE comments;
DROP TABLE checklist_items;
DROP TABLE card_labels;
DROP TABLE labels;
ALTER TABLE projects DROP COLUMN progress;
ALTER TABLE cards
    DROP COLUMN checklist_total,
    DROP COLUMN checklist_done,
    DROP COLUMN comment_count,
    DROP COLUMN attachment_count;
