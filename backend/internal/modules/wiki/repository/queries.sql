-- wiki module queries (sqlc). Nodes are always filtered by deleted_at explicitly.

-- name: CreateSpace :one
INSERT INTO wiki_spaces (workspace_id, owner_id, name, icon, color, description, visibility, workspace_role, max_depth)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: GetSpace :one
SELECT * FROM wiki_spaces WHERE id = $1;

-- name: ListSpaces :many
SELECT * FROM wiki_spaces WHERE workspace_id = $1 ORDER BY lower(name), id;

-- name: UpdateSpace :one
UPDATE wiki_spaces
SET name = $2, icon = $3, color = $4, description = $5, max_depth = $6, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: SetSpaceVisibility :one
UPDATE wiki_spaces SET visibility = $2, workspace_role = $3, updated_at = now() WHERE id = $1 RETURNING *;

-- name: DeleteSpace :exec
DELETE FROM wiki_spaces WHERE id = $1;

-- name: CreateNode :one
INSERT INTO wiki_nodes (id, workspace_id, space_id, parent_id, kind, title, icon, rank, depth, path, owner_id, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
RETURNING *;

-- name: GetNode :one
SELECT * FROM wiki_nodes WHERE id = $1;

-- name: GetNodes :many
SELECT * FROM wiki_nodes WHERE id = ANY(sqlc.arg('ids')::uuid[]);

-- name: ListSpaceNodes :many
SELECT * FROM wiki_nodes WHERE space_id = $1 ORDER BY depth, rank, id;

-- name: ListSiblings :many
SELECT * FROM wiki_nodes
WHERE space_id = $1 AND parent_id IS NOT DISTINCT FROM sqlc.narg('parent_id')::uuid AND deleted_at IS NULL
ORDER BY rank, id;

-- name: UpdateNodeMeta :one
UPDATE wiki_nodes SET title = $2, icon = $3, cover = $4, updated_at = now() WHERE id = $1 RETURNING *;

-- name: SetNodeVisibility :one
UPDATE wiki_nodes SET visibility = sqlc.narg('visibility'), workspace_role = $2, updated_at = now()
WHERE id = $1 RETURNING *;

-- name: PlaceNode :one
UPDATE wiki_nodes
SET space_id = $2, parent_id = $3, rank = $4, depth = $5, path = $6, updated_at = now()
WHERE id = $1
RETURNING *;

-- Rewrites the descendants of a moved node: swaps the path prefix, shifts depth, follows the space.
-- name: RebaseDescendants :exec
UPDATE wiki_nodes
SET path = sqlc.arg('new_prefix')::text || substr(path, length(sqlc.arg('old_prefix')::text) + 1),
    depth = depth + sqlc.arg('delta')::smallint,
    space_id = sqlc.arg('space_id')
WHERE path LIKE sqlc.arg('old_prefix')::text || '%' AND id <> sqlc.arg('id');

-- name: MoveGrantsToSpace :exec
UPDATE wiki_permissions SET space_id = sqlc.arg('space_id')
WHERE node_id IN (SELECT n.id FROM wiki_nodes n WHERE n.path LIKE sqlc.arg('prefix')::text || '%');

-- name: SubtreeMaxDepth :one
SELECT COALESCE(max(depth), 0)::int FROM wiki_nodes WHERE path LIKE sqlc.arg('prefix')::text || '%';

-- name: TrashSubtree :exec
UPDATE wiki_nodes SET deleted_at = now(), deleted_by = sqlc.arg('deleted_by'), trash_root_id = sqlc.arg('trash_root_id')
WHERE path LIKE sqlc.arg('prefix')::text || '%' AND deleted_at IS NULL;

-- name: RestoreTrashRoot :exec
UPDATE wiki_nodes SET deleted_at = NULL, deleted_by = NULL, trash_root_id = NULL WHERE trash_root_id = $1;

-- name: ListTrashRoots :many
SELECT * FROM wiki_nodes
WHERE workspace_id = $1 AND deleted_at IS NOT NULL AND id = trash_root_id AND deleted_at > $2
ORDER BY deleted_at DESC, id;

-- Permanent removal of a trashed subtree; independently trashed descendants (other roots) survive.
-- name: PurgeTrashRoot :exec
DELETE FROM wiki_nodes WHERE trash_root_id = $1;

-- name: PurgeExpiredTrash :execrows
DELETE FROM wiki_nodes n
WHERE n.trash_root_id IN (
    SELECT r.id FROM wiki_nodes r WHERE r.id = r.trash_root_id AND r.deleted_at < $1
);

-- name: UpsertPermission :one
INSERT INTO wiki_permissions (workspace_id, space_id, node_id, principal_kind, principal_id, role, created_by)
VALUES ($1, $2, sqlc.narg('node_id'), $3, $4, $5, $6)
ON CONFLICT (space_id, COALESCE(node_id, '00000000-0000-0000-0000-000000000000'::uuid), principal_kind, principal_id)
DO UPDATE SET role = EXCLUDED.role, created_by = EXCLUDED.created_by
RETURNING *;

-- name: GetPermission :one
SELECT * FROM wiki_permissions
WHERE space_id = $1 AND node_id IS NOT DISTINCT FROM sqlc.narg('node_id')::uuid
  AND principal_kind = $2 AND principal_id = $3;

-- name: DeletePermission :execrows
DELETE FROM wiki_permissions
WHERE space_id = $1 AND node_id IS NOT DISTINCT FROM sqlc.narg('node_id')::uuid
  AND principal_kind = $2 AND principal_id = $3;

-- name: ListSpacePermissions :many
SELECT * FROM wiki_permissions WHERE space_id = $1 ORDER BY created_at, id;

-- Grants of the space (node_id IS NULL) and of the given nodes: one chain.
-- name: ListChainPermissions :many
SELECT * FROM wiki_permissions
WHERE space_id = $1 AND (node_id IS NULL OR node_id = ANY(sqlc.arg('node_ids')::uuid[]))
ORDER BY created_at, id;

-- Nodes (live) holding a direct grant for the user or one of their teams, not owned by them.
-- name: ListGrantedNodes :many
SELECT DISTINCT n.* FROM wiki_nodes n
JOIN wiki_permissions p ON p.node_id = n.id
WHERE n.workspace_id = $1 AND n.deleted_at IS NULL AND n.owner_id <> $2
  AND ((p.principal_kind = 'user' AND p.principal_id = $2)
    OR (p.principal_kind = 'team' AND p.principal_id = ANY(sqlc.arg('team_ids')::uuid[])))
ORDER BY n.updated_at DESC, n.id
LIMIT 200;

-- name: ListOwnedNodes :many
SELECT * FROM wiki_nodes
WHERE workspace_id = $1 AND owner_id = $2 AND deleted_at IS NULL
ORDER BY updated_at DESC, id
LIMIT 1000;

-- name: AddFavorite :exec
INSERT INTO wiki_favorites (user_id, node_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: RemoveFavorite :exec
DELETE FROM wiki_favorites WHERE user_id = $1 AND node_id = $2;

-- name: ListFavoriteNodes :many
SELECT n.* FROM wiki_favorites f
JOIN wiki_nodes n ON n.id = f.node_id
WHERE f.user_id = $1 AND n.workspace_id = $2 AND n.deleted_at IS NULL
ORDER BY f.created_at DESC, n.id;

-- name: FavoriteIDs :many
SELECT f.node_id FROM wiki_favorites f
JOIN wiki_nodes n ON n.id = f.node_id
WHERE f.user_id = $1 AND n.space_id = $2;

-- name: TouchRecent :exec
INSERT INTO wiki_recents (user_id, node_id) VALUES ($1, $2)
ON CONFLICT (user_id, node_id) DO UPDATE SET viewed_at = now();

-- name: ListRecentNodes :many
SELECT n.* FROM wiki_recents r
JOIN wiki_nodes n ON n.id = r.node_id
WHERE r.user_id = $1 AND n.workspace_id = $2 AND n.deleted_at IS NULL
ORDER BY r.viewed_at DESC, n.id
LIMIT $3;

-- name: InsertAudit :exec
INSERT INTO wiki_audit (workspace_id, space_id, node_id, actor_id, kind, data)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: ListAudit :many
SELECT * FROM wiki_audit
WHERE space_id = $1 AND ($2::bigint = 0 OR id < $2)
ORDER BY id DESC
LIMIT $3;
