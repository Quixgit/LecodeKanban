# ADR 0019: Integrations

Status: accepted

## Context

The Integrations page was a placeholder and the sidebar card announced a hard-coded meeting link.
People want their Google Calendar meetings in the app, with a reminder before they start, and to be able to
switch the integration on and off.

## Decision

- An `integrations` module owns one row per person, provider and workspace: enabled flag, the account's
  address, the **refresh token sealed with the encryption key** (AES-GCM, bound to person and provider), the
  reminder lead time, whether to ring the bell and an optional chat channel.
- OAuth uses the existing Google client with offline access and the least scope that works
  (`calendar.events.readonly`, plus identity). The `state` is sealed and expires in ten minutes; the callback
  is public (the browser arrives from Google) and identifies the person only through that state.
- A cache of the next week of events (`calendar_events`) is refreshed by a loop in the server process
  every five minutes per connection. Reminders are claimed with an atomic `UPDATE … WHERE notified_at IS NULL`,
  so several instances never send one twice. A meeting that moves by more than a minute is re-armed.
- A reminder becomes a notification of kind `meeting` (bell, pop-up, sound) and, if chosen, a system message
  in a channel carrying a `meeting` payload that chat renders as a card. The notifications and chat modules
  are reached through small ports; the integrations module never reads their tables.
- A revoked grant marks the connection `error`; the page asks the person to connect again. Pausing keeps the
  account but stops the sync and every reminder; disconnecting deletes the token and cached events.
- Google endpoints can be overridden by configuration (`LK_GOOGLE_*_URL`) so tests and local trials use a
  stand-in server (`frontend/e2e/support/fakeGoogle.mjs`).

## Consequences

- Reading calendars needs the Calendar API enabled and, for use beyond test users, Google app verification.
- Only the primary calendar is read; recurring events are expanded by Google.
- More providers fit the same shape: a connection row, a sync loop and events that become notifications.
