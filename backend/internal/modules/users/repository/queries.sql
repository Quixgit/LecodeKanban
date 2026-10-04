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
SET name      = COALESCE(sqlc.narg(name), name),
    locale    = COALESCE(sqlc.narg(locale), locale),
    job_title = COALESCE(sqlc.narg(job_title), job_title),
    phone     = COALESCE(sqlc.narg(phone), phone),
    location  = COALESCE(sqlc.narg(location), location),
    timezone  = COALESCE(sqlc.narg(timezone), timezone),
    bio       = COALESCE(sqlc.narg(bio), bio),
    pronouns  = COALESCE(sqlc.narg(pronouns), pronouns),
    linkedin  = COALESCE(sqlc.narg(linkedin), linkedin),
    telegram  = COALESCE(sqlc.narg(telegram), telegram),
    website   = COALESCE(sqlc.narg(website), website),
    work_start = COALESCE(sqlc.narg(work_start), work_start),
    work_end   = COALESCE(sqlc.narg(work_end), work_end),
    skills     = COALESCE(sqlc.narg(skills)::text[], skills),
    cover_preset = COALESCE(sqlc.narg(cover_preset), cover_preset)
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

-- name: GetAvatar :one
SELECT avatar_key, avatar_type FROM users WHERE id = $1;

-- name: SetUploadedAvatar :exec
UPDATE users SET avatar_url = @avatar_url, avatar_key = @avatar_key, avatar_type = @avatar_type WHERE id = @id;

-- name: ClearAvatar :exec
UPDATE users SET avatar_url = NULL, avatar_key = NULL, avatar_type = NULL WHERE id = @id;

-- name: GetCover :one
SELECT cover_key, cover_type FROM users WHERE id = $1;

-- name: SetUploadedCover :exec
UPDATE users SET cover_url = @cover_url, cover_key = @cover_key, cover_type = @cover_type, cover_preset = '' WHERE id = @id;

-- name: ClearCover :exec
UPDATE users SET cover_url = NULL, cover_key = NULL, cover_type = NULL WHERE id = $1;
