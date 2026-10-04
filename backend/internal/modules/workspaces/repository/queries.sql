-- name: CreateWorkspace :one
INSERT INTO workspaces (name, slug, created_by) VALUES (@name, @slug, @created_by) RETURNING *;

-- name: GetWorkspace :one
SELECT * FROM workspaces WHERE id = $1;

-- name: UpdateWorkspaceName :one
UPDATE workspaces SET name = @name WHERE id = @id RETURNING *;

-- name: DeleteWorkspace :exec
DELETE FROM workspaces WHERE id = $1;

-- name: ListWorkspacesForUser :many
SELECT w.id, w.name, w.slug, w.created_at, m.role,
       (SELECT count(*) FROM workspace_members mm WHERE mm.workspace_id = w.id)::int AS member_count
FROM workspaces w
JOIN workspace_members m ON m.workspace_id = w.id
WHERE m.user_id = $1
ORDER BY w.created_at;

-- name: CountMemberships :one
SELECT count(*)::int FROM workspace_members WHERE user_id = $1;

-- name: AddMember :exec
INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (@workspace_id, @user_id, @role)
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- name: GetMemberRole :one
SELECT role FROM workspace_members WHERE workspace_id = @workspace_id AND user_id = @user_id;

-- name: ListMembers :many
SELECT m.user_id, m.role, m.joined_at, m.custom_role_id, cr.name AS custom_name
FROM workspace_members m LEFT JOIN workspace_roles cr ON cr.id = m.custom_role_id
WHERE m.workspace_id = $1 ORDER BY m.joined_at;

-- name: CountOwners :one
SELECT count(*)::int FROM workspace_members WHERE workspace_id = $1 AND role = 'owner';

-- name: UpdateMemberRole :exec
UPDATE workspace_members SET role = @role WHERE workspace_id = @workspace_id AND user_id = @user_id;

-- name: RemoveMember :exec
DELETE FROM workspace_members WHERE workspace_id = @workspace_id AND user_id = @user_id;

-- name: CreateInvite :one
INSERT INTO workspace_invites (workspace_id, email, role, token_hash, invited_by, expires_at)
VALUES (@workspace_id, @email, @role, @token_hash, @invited_by, @expires_at)
RETURNING *;

-- name: DeleteOpenInviteForEmail :exec
DELETE FROM workspace_invites WHERE workspace_id = @workspace_id AND email = @email AND accepted_at IS NULL;

-- name: ListOpenInvites :many
SELECT * FROM workspace_invites
WHERE workspace_id = $1 AND accepted_at IS NULL AND expires_at > now()
ORDER BY created_at DESC;

-- name: GetInviteByHash :one
SELECT * FROM workspace_invites WHERE token_hash = $1;

-- name: GetInviteByHashForUpdate :one
SELECT * FROM workspace_invites WHERE token_hash = $1 FOR UPDATE;

-- name: DeleteInvite :execrows
DELETE FROM workspace_invites WHERE workspace_id = @workspace_id AND id = @id AND accepted_at IS NULL;

-- name: MarkInviteAccepted :exec
UPDATE workspace_invites SET accepted_at = now() WHERE id = $1;

-- name: GetSettings :one
SELECT data FROM workspace_settings WHERE workspace_id = $1;

-- name: PutSettings :exec
INSERT INTO workspace_settings (workspace_id, data) VALUES (@workspace_id, @data)
ON CONFLICT (workspace_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();

-- name: AddAudit :exec
INSERT INTO workspace_audit (workspace_id, actor_id, action, details) VALUES (@workspace_id, @actor_id, @action, @details);

-- name: ListAudit :many
SELECT id, actor_id, action, details, at FROM workspace_audit WHERE workspace_id = $1 ORDER BY at DESC, id LIMIT $2;

-- name: MemberAccess :one
SELECT m.role, m.custom_role_id, cr.name AS custom_name, cr.permissions AS custom_perms, o.permissions AS override_perms
FROM workspace_members m
LEFT JOIN workspace_roles cr ON cr.id = m.custom_role_id
LEFT JOIN workspace_role_overrides o ON o.workspace_id = m.workspace_id AND o.role = m.role
WHERE m.workspace_id = $1 AND m.user_id = $2;

-- name: ListRoleOverrides :many
SELECT role, permissions FROM workspace_role_overrides WHERE workspace_id = $1;

-- name: PutRoleOverride :exec
INSERT INTO workspace_role_overrides (workspace_id, role, permissions) VALUES (@workspace_id, @role, @permissions)
ON CONFLICT (workspace_id, role) DO UPDATE SET permissions = EXCLUDED.permissions;

-- name: DeleteRoleOverride :exec
DELETE FROM workspace_role_overrides WHERE workspace_id = $1 AND role = $2;

-- name: ListCustomRoles :many
SELECT r.*, (SELECT count(*) FROM workspace_members m WHERE m.custom_role_id = r.id)::int AS members
FROM workspace_roles r WHERE r.workspace_id = $1 ORDER BY lower(r.name);

-- name: GetCustomRole :one
SELECT * FROM workspace_roles WHERE id = $1;

-- name: CreateCustomRole :one
INSERT INTO workspace_roles (workspace_id, name, description, base, permissions)
VALUES (@workspace_id, @name, @description, @base, @permissions) RETURNING *;

-- name: UpdateCustomRole :one
UPDATE workspace_roles SET name = @name, description = @description, base = @base, permissions = @permissions
WHERE id = @id RETURNING *;

-- name: DeleteCustomRole :exec
DELETE FROM workspace_roles WHERE id = $1;

-- name: SetMemberCustomRole :exec
UPDATE workspace_members SET custom_role_id = @custom_role_id, role = @role WHERE workspace_id = @workspace_id AND user_id = @user_id;

-- name: CountMembersOfRole :one
SELECT count(*)::int FROM workspace_members WHERE workspace_id = $1 AND role = $2 AND custom_role_id IS NULL;
