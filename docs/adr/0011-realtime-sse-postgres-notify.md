# 0011 — Realtime updates: SSE fed by Postgres LISTEN/NOTIFY

- Status: accepted
- Date: 2026-10-01

## Context

Board changes (card moved, created, commented …) must appear live for other users. The API and
the worker are separate processes, and later phases create cards from background jobs (Gmail,
Calendar, GitHub webhooks), so an in-process hub alone would miss those changes.

## Decision

- Publishers call `pg_notify('lk_realtime', json)` after the change is committed (via event-bus
  reactions in `internal/reactions`). Any process with a DB pool can publish.
- Each API instance runs one `realtime.Hub` on a **dedicated** connection (`LISTEN`), reconnects
  with capped backoff, and fans messages out to subscribers of the message's workspace.
- Browsers subscribe with **Server-Sent Events** at `GET /workspaces/{id}/events` (cookie auth,
  workspace membership checked). Events: `ready`, `change`, `resync` (buffer overflow or listener
  reconnect → client refetches). A 25 s comment heartbeat keeps proxies open; the handler sets
  `X-Accel-Buffering: no` and clears the server write deadline; the request-timeout middleware
  skips `Accept: text/event-stream`.
- Messages are **hints** (`type`, `workspaceId`, `projectId`, `cardId`, `actorId`), never data:
  clients refetch through the authorised REST API, so permissions are enforced in one place and
  payloads stay far below NOTIFY's 8 kB limit.
- On shutdown the hub closes all streams (`http.Server.RegisterOnShutdown`) so draining finishes.

SSE was chosen over WebSocket: traffic is server → client only, it works through the existing
nginx proxy and cookie auth without an upgrade handshake, and browsers reconnect automatically.

## Consequences

- Delivery is best-effort; a lost hint only delays a refresh (the next hint, focus refetch or
  `resync` heals it).
- Horizontal scaling needs no extra broker: every instance listens to the same channel.
