-- +goose Up
-- Projects (owned by the projects module).
CREATE TABLE projects (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    key          text        NOT NULL CHECK (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
    name         text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    description  text        NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
    status       text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    pic_user_id  uuid        REFERENCES users (id) ON DELETE SET NULL,
    team         text        CHECK (team IS NULL OR length(team) BETWEEN 1 AND 60),
    icon         text        NOT NULL DEFAULT 'folder',
    tone         text        NOT NULL DEFAULT 'teal' CHECK (tone IN ('teal', 'amber', 'purple', 'red', 'neutral')),
    start_date   date,
    deadline     date,
    -- Denormalised from cards (kept in sync via events) so lists can filter/sort by progress.
    task_count   integer     NOT NULL DEFAULT 0,
    done_count   integer     NOT NULL DEFAULT 0,
    created_by   uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    archived_at  timestamptz,
    CONSTRAINT projects_workspace_key UNIQUE (workspace_id, key)
);
CREATE INDEX projects_workspace_idx ON projects (workspace_id) WHERE archived_at IS NULL;
CREATE INDEX projects_name_trgm ON projects USING gin (name gin_trgm_ops);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Boards and columns (owned by the boards module). One board per project for now.
CREATE TABLE boards (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id   uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name         text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT boards_project_key UNIQUE (project_id)
);

CREATE TABLE board_columns (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id   uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    name       text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
    -- Category maps custom columns onto the four workflow statuses.
    category   text        NOT NULL CHECK (category IN ('todo', 'in_progress', 'in_review', 'done')),
    position   text        NOT NULL,
    wip_limit  integer     CHECK (wip_limit IS NULL OR wip_limit > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX board_columns_board_idx ON board_columns (board_id, position);

-- Cards (owned by the cards module).
CREATE TABLE card_counters (
    project_id uuid PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
    next       integer NOT NULL DEFAULT 1
);

CREATE TABLE cards (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id   uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    board_id     uuid        NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    column_id    uuid        NOT NULL REFERENCES board_columns (id) ON DELETE RESTRICT,
    number       integer     NOT NULL,
    title        text        NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
    description  text        NOT NULL DEFAULT '' CHECK (length(description) <= 50000),
    -- Denormalised from the column category for fast status filtering.
    status       text        NOT NULL CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
    priority     text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    progress     smallint    NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    due_date     date,
    position     text        NOT NULL,
    version      integer     NOT NULL DEFAULT 1,
    created_by   uuid        REFERENCES users (id) ON DELETE SET NULL,
    completed_at timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    archived_at  timestamptz,
    CONSTRAINT cards_project_number UNIQUE (project_id, number)
);
CREATE INDEX cards_workspace_status_idx ON cards (workspace_id, status) WHERE archived_at IS NULL;
CREATE INDEX cards_column_position_idx ON cards (column_id, position) WHERE archived_at IS NULL;
CREATE INDEX cards_project_idx ON cards (project_id) WHERE archived_at IS NULL;
CREATE INDEX cards_due_idx ON cards (workspace_id, due_date) WHERE archived_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX cards_title_trgm ON cards USING gin (title gin_trgm_ops);
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE card_assignees (
    card_id uuid NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, user_id)
);
CREATE INDEX card_assignees_user_idx ON card_assignees (user_id);

-- Status history: feeds the dashboard heatmap and activity feed (and cycle-time analytics later).
CREATE TABLE card_transitions (
    id           bigserial PRIMARY KEY,
    card_id      uuid        NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    workspace_id uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    project_id   uuid        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    from_status  text,
    to_status    text        NOT NULL,
    actor_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX card_transitions_ws_at_idx ON card_transitions (workspace_id, at DESC);

-- +goose Down
DROP TABLE card_transitions;
DROP TABLE card_assignees;
DROP TABLE cards;
DROP TABLE card_counters;
DROP TABLE board_columns;
DROP TABLE boards;
DROP TABLE projects;
