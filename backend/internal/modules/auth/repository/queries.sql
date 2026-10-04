-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, user_agent, ip)
VALUES (@user_id, @family_id, @token_hash, @expires_at, @user_agent, @ip)
RETURNING id;

-- name: GetRefreshTokenForUpdate :one
SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE;

-- name: MarkRefreshTokenRotated :exec
UPDATE refresh_tokens SET revoked_at = now(), replaced_by = @replaced_by WHERE id = @id;

-- name: RevokeRefreshFamily :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL;

-- name: RevokeUserRefreshTokens :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL;

-- name: DeleteExpiredRefreshTokens :exec
DELETE FROM refresh_tokens WHERE expires_at < now() - interval '1 day';

-- name: CreateUserToken :one
INSERT INTO user_tokens (user_id, purpose, token_hash, expires_at)
VALUES (@user_id, @purpose, @token_hash, @expires_at)
RETURNING id;

-- name: InvalidateUserTokens :exec
UPDATE user_tokens SET used_at = now() WHERE user_id = @user_id AND purpose = @purpose AND used_at IS NULL;

-- name: ConsumeUserToken :one
UPDATE user_tokens SET used_at = now()
WHERE token_hash = @token_hash AND purpose = @purpose AND used_at IS NULL AND expires_at > now()
RETURNING user_id;

-- name: GetIdentity :one
SELECT * FROM user_identities WHERE provider = @provider AND provider_user_id = @provider_user_id;

-- name: CreateIdentity :exec
INSERT INTO user_identities (user_id, provider, provider_user_id, email)
VALUES (@user_id, @provider, @provider_user_id, @email)
ON CONFLICT (provider, provider_user_id) DO NOTHING;

-- name: ListIdentityProviders :many
SELECT provider FROM user_identities WHERE user_id = $1 ORDER BY provider;

-- name: RevokeOtherUserRefreshTokens :exec
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = @user_id AND family_id <> @keep_family_id AND revoked_at IS NULL;

-- name: ListUserSessions :many
-- One row per sign-in (a family of rotated refresh tokens) that is still usable.
SELECT family_id,
       min(created_at)::timestamptz AS started_at,
       max(created_at)::timestamptz AS last_seen_at,
       (array_agg(user_agent ORDER BY created_at DESC))[1]::text AS user_agent,
       (array_agg(ip ORDER BY created_at DESC))[1]::text AS ip
FROM refresh_tokens
WHERE user_id = @user_id
GROUP BY family_id
HAVING bool_or(revoked_at IS NULL AND expires_at > now() AND replaced_by IS NULL)
ORDER BY max(created_at) DESC;

-- name: RevokeUserRefreshFamily :execrows
UPDATE refresh_tokens SET revoked_at = now()
WHERE user_id = @user_id AND family_id = @family_id AND revoked_at IS NULL;
