# 0004 — Public IP and non-standard port allocation

- Status: accepted
- Date: 2026-10-01

## Context

The app is served directly from the host's public IP `23.19.228.158` (requested by the owner),
not only behind a reverse proxy. The host already runs other services on common ports
(80, 443, 3000, 5173, 8080, 8087, 8090, 8094, 11000, 18080, …).

## Decision

LecodeKanban reserves the **47100–47109** range:

| Port | Service | Bind |
| --- | --- | --- |
| 47100 | Web (Vite dev server now; nginx serving the SPA in production) | `0.0.0.0` |
| 47101 | Go API (REST + WebSocket) | internal compose network in prod (nginx proxies `/api`, ADR 0009), `127.0.0.1` in dev (Vite proxies `/api`) |
| 47102 | PostgreSQL | `127.0.0.1` only |
| 47103 | Redis | `127.0.0.1` only |

All values are env-driven (`LK_WEB_PORT`, `LK_API_PORT`, …; see `.env.example`); Vite uses
`strictPort` so a clash fails loudly instead of silently picking another port.

## Consequences

- Without TLS on the bare IP, auth cookies cannot use the `Secure` flag; phase 2 will make
  `Secure` configurable (`LK_COOKIE_SECURE`) and default to on when a TLS origin is configured.
  Putting a TLS terminator (Caddy/Cloudflare) in front later only changes env, not code.
- Databases are never exposed publicly.
