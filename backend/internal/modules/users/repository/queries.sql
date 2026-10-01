-- name: CreateUser :one
INSERT INTO users (email, name, password_hash, locale, email_verified_at, avatar_url)
VALUES (@email, @name, sqlc.narg(password_hash), @locale, sqlc.narg(email_verified_at), sqlc.narg(avatar_url))
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUsersByIDs :many
SELECT * FROM users WHERE id = ANY(@ids::uuid[]) ORDER BY name;

-- name: UpdateUserProfile :one
UPDATE users
SET name   = COALESCE(sqlc.narg(name), name),
    locale = COALESCE(sqlc.narg(locale), locale)
WHERE id = @id
RETURNING *;

-- name: SetPasswordHash :exec
UPDATE users SET password_hash = @password_hash WHERE id = @id;

-- name: MarkEmailVerified :one
UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *;

-- name: RecordLoginFailure :one
-- Increments the failure counter and locks the account once it reaches the threshold.
UPDATE users
SET failed_login_count = failed_login_count + 1,
    locked_until = CASE WHEN failed_login_count + 1 >= @threshold::int
                        THEN now() + make_interval(secs => @lock_seconds::int)
                        ELSE locked_until END
WHERE id = @id
RETURNING failed_login_count, locked_until;

-- name: ResetLoginFailures :exec
UPDATE users SET failed_login_count = 0, locked_until = NULL
WHERE id = $1 AND (failed_login_count <> 0 OR locked_until IS NOT NULL);

-- name: SetAvatarIfEmpty :exec
UPDATE users SET avatar_url = @avatar_url WHERE id = @id AND avatar_url IS NULL;
