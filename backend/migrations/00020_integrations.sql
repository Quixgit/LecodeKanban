-- +goose Up
-- Integrations connect a person's outside accounts (Google Calendar first). One row per person,
-- provider and workspace; the refresh token is sealed with the encryption key (never stored plain).
CREATE TABLE integrations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    workspace_id      uuid        NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    provider          text        NOT NULL CHECK (provider IN ('google_calendar')),
    enabled           boolean     NOT NULL DEFAULT true,
    account_email     text        NOT NULL DEFAULT '',
    refresh_token_enc bytea       NOT NULL,
    -- Minutes before a meeting that the reminder fires.
    lead_minutes      int         NOT NULL DEFAULT 30 CHECK (lead_minutes BETWEEN 1 AND 1440),
    notify_bell       boolean     NOT NULL DEFAULT true,
    -- A chat channel that also gets the reminder (like Slack's calendar app); NULL for none.
    channel_id        uuid        REFERENCES chat_channels (id) ON DELETE SET NULL,
    status            text        NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error')),
    last_error        text        NOT NULL DEFAULT '',
    last_sync_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, workspace_id, provider)
);

-- A cache of upcoming events, refreshed by the sync loop.
CREATE TABLE calendar_events (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id    uuid        NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
    provider_event_id text        NOT NULL,
    title             text        NOT NULL,
    starts_at         timestamptz NOT NULL,
    ends_at           timestamptz NOT NULL,
    all_day           boolean     NOT NULL DEFAULT false,
    location          text        NOT NULL DEFAULT '',
    link              text        NOT NULL DEFAULT '',
    join_url          text        NOT NULL DEFAULT '',
    -- Invited people's addresses (rooms excluded), to show who is in the meeting.
    attendee_emails   text[]      NOT NULL DEFAULT '{}',
    -- When the reminder went out; NULL until then. Claimed atomically so it fires once.
    notified_at       timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (integration_id, provider_event_id)
);
CREATE INDEX calendar_events_start_idx ON calendar_events (integration_id, starts_at);

ALTER TABLE notifications ADD COLUMN link text;
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('assigned', 'task_moved', 'task_updated', 'task_commented', 'mention', 'dm', 'meeting'));

-- +goose Down
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('assigned', 'task_moved', 'task_updated', 'task_commented', 'mention', 'dm'));
ALTER TABLE notifications DROP COLUMN link;
DROP TABLE calendar_events;
DROP TABLE integrations;
