-- github module queries (sqlc).

-- name: UpsertConnection :one
INSERT INTO github_connections (workspace_id, connected_by, account_login, token_enc, webhook_secret_enc)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (workspace_id) DO UPDATE
SET connected_by = EXCLUDED.connected_by, account_login = EXCLUDED.account_login, token_enc = EXCLUDED.token_enc,
    webhook_secret_enc = EXCLUDED.webhook_secret_enc, enabled = true, updated_at = now()
RETURNING *;

-- name: GetConnection :one
SELECT * FROM github_connections WHERE workspace_id = $1;

-- name: UpdateRules :one
UPDATE github_connections
SET enabled = $2, pr_opened_to_review = $3, pr_merged_to_done = $4, sync_issues = $5, comment_on_pr = $6, updated_at = now()
WHERE workspace_id = $1
RETURNING *;

-- name: DeleteConnection :exec
DELETE FROM github_connections WHERE workspace_id = $1;

-- name: InsertRepo :one
INSERT INTO github_repos (workspace_id, project_id, full_name, hook_id) VALUES ($1, $2, $3, $4) RETURNING *;

-- name: ListRepos :many
SELECT * FROM github_repos WHERE workspace_id = $1 ORDER BY full_name;

-- name: GetRepo :one
SELECT * FROM github_repos WHERE id = $1;

-- name: GetRepoByName :one
SELECT * FROM github_repos WHERE lower(full_name) = lower($1);

-- name: GetRepoByProject :one
SELECT * FROM github_repos WHERE project_id = $1;

-- name: DeleteRepo :exec
DELETE FROM github_repos WHERE id = $1 AND workspace_id = $2;

-- name: UpsertLink :one
INSERT INTO github_links (card_id, repo_id, kind, number, title, state, url, author)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (repo_id, kind, number, card_id) DO UPDATE
SET title = EXCLUDED.title, state = EXCLUDED.state, url = EXCLUDED.url, author = EXCLUDED.author, updated_at = now()
RETURNING *;

-- name: LinksForCard :many
SELECT l.*, r.full_name FROM github_links l JOIN github_repos r ON r.id = l.repo_id
WHERE l.card_id = $1 ORDER BY l.kind DESC, l.number;

-- name: LinksForRef :many
SELECT * FROM github_links WHERE repo_id = $1 AND kind = $2 AND number = $3;

-- name: SetLinkState :exec
UPDATE github_links SET state = $4, updated_at = now() WHERE repo_id = $1 AND kind = $2 AND number = $3;

-- name: ClaimDelivery :one
INSERT INTO github_deliveries (delivery_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING delivery_id;

-- name: PruneDeliveries :exec
DELETE FROM github_deliveries WHERE received_at < $1;
