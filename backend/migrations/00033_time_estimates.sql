-- +goose Up
-- The time a task is expected to take, so logged time can be shown against it. Kept beside the time entries
-- (not on the card) so the time module owns everything about time.
CREATE TABLE card_estimates (
    card_id    uuid PRIMARY KEY REFERENCES cards (id) ON DELETE CASCADE,
    seconds    integer NOT NULL CHECK (seconds BETWEEN 60 AND 3600000),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE card_estimates;
