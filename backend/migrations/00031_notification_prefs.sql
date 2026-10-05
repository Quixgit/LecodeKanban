-- +goose Up
CREATE TABLE notification_prefs (
    user_id uuid    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind    text    NOT NULL,
    enabled boolean NOT NULL,
    PRIMARY KEY (user_id, kind)
);

-- +goose Down
DROP TABLE notification_prefs;
