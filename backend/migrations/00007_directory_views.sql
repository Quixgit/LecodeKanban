-- +goose Up
-- Published read models: a module may expose a view as its public, read-only SQL contract.
-- Other modules may JOIN these views (never the underlying tables) for filtering/sorting.

-- users module
CREATE VIEW user_directory AS
SELECT id, name, email, avatar_url FROM users;

-- projects module
CREATE VIEW project_directory AS
SELECT id, workspace_id, key, name, icon, tone, archived_at FROM projects;

-- +goose Down
DROP VIEW project_directory;
DROP VIEW user_directory;
