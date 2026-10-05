# 0009 — Always-on Docker deployment on the host

- Status: accepted
- Date: 2026-10-01

## Context

Until phase 3 the app ran from `make dev` (air + Vite) started in an interactive session; when
the session ended the app on `http://203.0.113.10:47100` went down. The owner wants it reachable
permanently. The deploy user has no sudo and no systemd linger, but is in the `docker` group, and
`docker.service` is enabled at boot.

## Decision

Bring the production part of phase 9 forward: `docker-compose.yml` runs the whole stack with
`restart: unless-stopped`, which the Docker daemon honours after crashes and reboots.

- `backend/Dockerfile` — multi-stage build, distroless `nonroot` image with `server`, `worker`,
  `migrate`, `seed`. `server healthcheck` probes `/healthz` (no shell in distroless).
- `frontend/Dockerfile` — Vite build served by `nginx-unprivileged`; nginx proxies `/api`
  (REST + WebSocket) to the API so cookies stay first-party and appends the client IP to
  `X-Forwarded-For` (the API trusts the rightmost entry, ADR 0004).
- A one-shot `migrate` service runs before `api` and `worker`; the worker runs separately
  (`LK_EMBEDDED_WORKER=false`).
- Only the web port (47100) is published publicly. The API is internal to the compose network;
  Postgres and SMTP bind to `127.0.0.1` with the same ports as before.

The data of the former dev stack (`lecodekanban-dev_pgdata`) was copied into `lecodekanban_pgdata`;
the old volume is kept untouched as a fallback.

## Consequences

- `make deploy` rebuilds and restarts; this is the update procedure after code changes.
- The dev stack (`docker-compose.dev.yml`, `make dev`) uses the same ports and cannot run at the
  same time; stop the production stack first for hot-reload work.
- Still to do in phase 9: TLS terminator, strict CSP (needs a hash for the inline theme script),
  backups, CI image builds.
