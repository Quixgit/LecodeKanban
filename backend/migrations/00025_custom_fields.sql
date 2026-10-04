-- +goose Up
CREATE TABLE custom_fields (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         text NOT NULL,
    description  text NOT NULL DEFAULT '',
    kind         text NOT NULL CHECK (kind IN ('text', 'number', 'date', 'select', 'checkbox', 'url')),
    options      jsonb NOT NULL DEFAULT '[]',
    show_on_card boolean NOT NULL DEFAULT false,
    position     integer NOT NULL DEFAULT 0,
    archived_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX custom_fields_name_idx ON custom_fields (workspace_id, lower(name)) WHERE archived_at IS NULL;

CREATE TABLE card_field_values (
    card_id      uuid NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
    field_id     uuid NOT NULL REFERENCES custom_fields (id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    value        jsonb NOT NULL,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (card_id, field_id)
);
CREATE INDEX card_field_values_ws_idx ON card_field_values (workspace_id, field_id);

-- +goose Down
DROP TABLE card_field_values;
DROP TABLE custom_fields;
