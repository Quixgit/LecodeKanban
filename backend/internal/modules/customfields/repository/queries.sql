-- name: ListFields :many
SELECT * FROM custom_fields WHERE workspace_id = $1 AND archived_at IS NULL ORDER BY position, created_at, id;

-- name: GetField :one
SELECT * FROM custom_fields WHERE id = $1 AND archived_at IS NULL;

-- name: CountFields :one
SELECT count(*)::int FROM custom_fields WHERE workspace_id = $1 AND archived_at IS NULL;

-- name: CreateField :one
INSERT INTO custom_fields (workspace_id, name, description, kind, options, show_on_card, position)
VALUES (@workspace_id, @name, @description, @kind, @options, @show_on_card,
        (SELECT COALESCE(max(position) + 1, 0) FROM custom_fields WHERE workspace_id = @workspace_id AND archived_at IS NULL))
RETURNING *;

-- name: UpdateField :one
UPDATE custom_fields
SET name         = COALESCE(sqlc.narg(name), name),
    description  = COALESCE(sqlc.narg(description), description),
    options      = COALESCE(sqlc.narg(options), options),
    show_on_card = COALESCE(sqlc.narg(show_on_card), show_on_card)
WHERE id = @id AND archived_at IS NULL
RETURNING *;

-- name: ArchiveField :exec
UPDATE custom_fields SET archived_at = now() WHERE id = $1 AND archived_at IS NULL;

-- name: SetFieldPosition :exec
UPDATE custom_fields SET position = $2 WHERE id = $1 AND workspace_id = $3;

-- name: ListValuesForCard :many
SELECT * FROM card_field_values WHERE card_id = $1;

-- name: ListValuesForCards :many
SELECT * FROM card_field_values WHERE workspace_id = @workspace_id AND card_id = ANY(@card_ids::uuid[]);

-- name: UpsertValue :exec
INSERT INTO card_field_values (card_id, field_id, workspace_id, value)
VALUES (@card_id, @field_id, @workspace_id, @value)
ON CONFLICT (card_id, field_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- name: DeleteValue :exec
DELETE FROM card_field_values WHERE card_id = $1 AND field_id = $2;

-- name: DeleteValuesOutsideOptions :exec
-- Drops values that point at select options that no longer exist.
DELETE FROM card_field_values WHERE field_id = @field_id AND NOT ((value #>> '{}') = ANY(@keep::text[]));

-- name: CountFieldUses :one
SELECT count(*)::int FROM card_field_values WHERE field_id = $1;
