-- integrations module queries (sqlc).

-- name: UpsertIntegration :one
INSERT INTO integrations (user_id, workspace_id, provider, account_email, refresh_token_enc)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, workspace_id, provider) DO UPDATE
SET account_email = EXCLUDED.account_email, refresh_token_enc = EXCLUDED.refresh_token_enc,
    enabled = true, status = 'connected', last_error = '', updated_at = now()
RETURNING *;

-- name: GetIntegration :one
SELECT * FROM integrations WHERE user_id = $1 AND workspace_id = $2 AND provider = $3;

-- name: ListIntegrations :many
SELECT * FROM integrations WHERE user_id = $1 AND workspace_id = $2 ORDER BY provider;

-- name: UpdateIntegrationSettings :one
UPDATE integrations SET enabled = $4, lead_minutes = $5, notify_bell = $6, channel_id = $7, updated_at = now()
WHERE user_id = $1 AND workspace_id = $2 AND provider = $3
RETURNING *;

-- name: DeleteIntegration :exec
DELETE FROM integrations WHERE user_id = $1 AND workspace_id = $2 AND provider = $3;

-- name: ListDueForSync :many
SELECT * FROM integrations
WHERE enabled AND status = 'connected' AND (last_sync_at IS NULL OR last_sync_at < $1);

-- name: MarkSynced :exec
UPDATE integrations SET last_sync_at = now(), status = 'connected', last_error = '', updated_at = now() WHERE id = $1;

-- name: MarkSyncFailed :exec
UPDATE integrations SET last_sync_at = now(), status = $2, last_error = $3, updated_at = now() WHERE id = $1;

-- name: UpsertEvent :exec
INSERT INTO calendar_events (integration_id, provider_event_id, title, starts_at, ends_at, all_day, location, link, join_url, attendee_emails)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (integration_id, provider_event_id) DO UPDATE
SET title = EXCLUDED.title, ends_at = EXCLUDED.ends_at, all_day = EXCLUDED.all_day, location = EXCLUDED.location,
    link = EXCLUDED.link, join_url = EXCLUDED.join_url, attendee_emails = EXCLUDED.attendee_emails,
    -- A meeting moved by more than a minute earns a fresh reminder.
    notified_at = CASE WHEN abs(extract(epoch FROM (calendar_events.starts_at - EXCLUDED.starts_at))) > 60
                       THEN NULL ELSE calendar_events.notified_at END,
    starts_at = EXCLUDED.starts_at, updated_at = now();

-- name: DeleteEventsNotIn :exec
DELETE FROM calendar_events
WHERE integration_id = $1 AND ends_at >= $2 AND NOT (provider_event_id = ANY($3::text[]));

-- name: ListUpcomingEvents :many
SELECT e.* FROM calendar_events e JOIN integrations i ON i.id = e.integration_id
WHERE i.user_id = $1 AND i.workspace_id = $2 AND i.enabled AND e.ends_at > $3
ORDER BY e.starts_at
LIMIT $4;

-- name: ListEventsForIntegration :many
SELECT * FROM calendar_events WHERE integration_id = $1 AND ends_at > $2 ORDER BY starts_at LIMIT $3;

-- name: ListDueReminders :many
SELECT e.id AS event_id, i.id AS integration_id
FROM calendar_events e JOIN integrations i ON i.id = e.integration_id
WHERE i.enabled AND i.status = 'connected' AND e.notified_at IS NULL AND NOT e.all_day
  AND e.starts_at > $1 AND e.starts_at - make_interval(mins => i.lead_minutes) <= $1;

-- name: ClaimReminder :one
UPDATE calendar_events SET notified_at = now() WHERE id = $1 AND notified_at IS NULL RETURNING *;

-- name: GetIntegrationByID :one
SELECT * FROM integrations WHERE id = $1;
