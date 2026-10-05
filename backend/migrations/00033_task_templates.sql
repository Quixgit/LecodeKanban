-- +goose Up
-- A task template: the starting point of a task (fields, checklist, subtasks). Labels and people are kept as
-- ids without foreign keys: one that no longer exists is simply left out when the template is used.
CREATE TABLE task_templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
    description  text NOT NULL DEFAULT '' CHECK (length(description) <= 50000),
    priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    label_ids    uuid[] NOT NULL DEFAULT '{}',
    assignee_ids uuid[] NOT NULL DEFAULT '{}',
    checklist    text[] NOT NULL DEFAULT '{}',
    subtasks     text[] NOT NULL DEFAULT '{}',
    due_in_days  integer CHECK (due_in_days BETWEEN 0 AND 365),
    created_by   uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX task_templates_name_idx ON task_templates (workspace_id, lower(name));

-- A recurring task: a template turned into a new task on a schedule.
CREATE TABLE recurring_tasks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    template_id  uuid NOT NULL REFERENCES task_templates (id) ON DELETE CASCADE,
    project_id   uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    freq         text NOT NULL CHECK (freq IN ('daily', 'weekly', 'monthly')),
    weekdays     smallint[] NOT NULL DEFAULT '{}', -- 1 = Monday … 7 = Sunday, for weekly
    month_day    smallint CHECK (month_day BETWEEN 1 AND 31),
    hour         smallint NOT NULL DEFAULT 9 CHECK (hour BETWEEN 0 AND 23),
    timezone     text NOT NULL DEFAULT 'UTC',
    active       boolean NOT NULL DEFAULT true,
    next_run_at  timestamptz NOT NULL,
    last_run_at  timestamptz,
    last_card_id uuid,
    last_error   text,
    created_by   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recurring_tasks_due_idx ON recurring_tasks (next_run_at) WHERE active;
CREATE INDEX recurring_tasks_ws_idx ON recurring_tasks (workspace_id);

-- +goose Down
DROP TABLE recurring_tasks;
DROP TABLE task_templates;
