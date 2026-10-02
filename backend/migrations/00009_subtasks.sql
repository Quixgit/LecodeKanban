-- +goose Up
-- Subtasks: a card may have a parent card of the same project (one level deep). Counters feed the
-- parent's badge and derived progress (docs/adr/0013-subtasks-and-time-tracking.md).
ALTER TABLE cards
    ADD COLUMN parent_id      uuid REFERENCES cards (id) ON DELETE CASCADE,
    ADD COLUMN subtask_total  integer NOT NULL DEFAULT 0,
    ADD COLUMN subtask_done   integer NOT NULL DEFAULT 0,
    ADD CONSTRAINT cards_not_own_parent CHECK (parent_id IS DISTINCT FROM id);
CREATE INDEX cards_parent_idx ON cards (parent_id) WHERE parent_id IS NOT NULL AND archived_at IS NULL;

-- +goose Down
DROP INDEX cards_parent_idx;
ALTER TABLE cards
    DROP CONSTRAINT cards_not_own_parent,
    DROP COLUMN subtask_done,
    DROP COLUMN subtask_total,
    DROP COLUMN parent_id;
