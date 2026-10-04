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
SELECT user_id, role, joined_at FROM workspace_members WHERE workspace_id = $1 ORDER BY joined_at;

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

-- name: ListWorkspaceMail :many
-- The latest emails addressed to people of this workspace (members and invited addresses).
SELECT j.id, j.status, j.attempts, j.max_attempts, COALESCE(j.last_error, '')::text AS last_error, j.created_at,
       COALESCE(j.payload->>'to', '')::text AS recipient, COALESCE(j.payload->>'subject', '')::text AS subject
FROM jobs j
WHERE j.kind = 'mail.send'
  AND lower(j.payload->>'to') IN (
      SELECT lower(u.email) FROM workspace_members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = @workspace_id
      UNION
      SELECT lower(email) FROM workspace_invites WHERE workspace_id = @workspace_id)
ORDER BY j.id DESC
LIMIT 20;

-- name: MailQueueCounts :one
SELECT count(*) FILTER (WHERE status IN ('pending', 'running'))::int AS waiting,
       count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '7 days')::int AS failed
FROM jobs WHERE kind = 'mail.send';
