# LecodeKanban

A modular Kanban and project-management app: Go modular-monolith backend and a React/TypeScript
frontend, with GitHub, Gmail and Google Calendar integrations, in Ukrainian and English.

> **Status: phases 1–4 of 9, plus subtasks and time tracking.** Done so far:
> - the design system, app shell, light/dark themes, Ukrainian and English;
> - the backend platform and authentication (email + password, OAuth, sessions, RBAC, invites);
> - projects, boards, cards, the Tasks list, Projects and Dashboard pages;
> - the Kanban view: drag and drop, swimlanes, WIP limits, custom columns, saved views, realtime
>   updates, and the card drawer (description, checklist, **subtasks**, **time tracking**,
>   attachments with previews, comments with @mentions, activity).
>
> Next: Calendar and the Google Calendar, GitHub and Gmail integrations (phases 5–7).

## Requirements

Go 1.24+ (developed on 1.27), Node 20.19+, Docker (Postgres/Mailpit in dev and testcontainers in
tests), and optionally [golangci-lint](https://golangci-lint.run) v2.

## Quick start

```bash
cp .env.example .env      # then fill in the secrets (see comments inside)
make install              # Go modules + npm packages
make dev                  # Postgres + Mailpit, migrations, API (hot reload) and web
```

| What | Where |
| --- | --- |
| App | `http://23.19.228.158:47100` (`LK_PUBLIC_URL`) |
| UI kit | `/ui-kit` (after signing in) |
| Dev mailbox (Mailpit, basic auth `LK_MAILPIT_UI_AUTH`) | `http://23.19.228.158:47105` |
| API health / readiness | `127.0.0.1:47101/healthz`, `/readyz` |
| Prometheus metrics | `127.0.0.1:47106/metrics` |

Register at `/register`. The verification email arrives in Mailpit. Invite teammates from **Team**.
Press <kbd>Ctrl/⌘</kbd>+<kbd>K</kbd> anywhere for the command palette.

## Always-on deployment (this host)

The app runs permanently from `docker-compose.yml` (Postgres, Mailpit, migrations, API, worker,
nginx serving the SPA and proxying `/api`). Every service uses `restart: unless-stopped`, so the
Docker daemon brings it back after crashes and reboots — no terminal session needed.

```bash
make deploy        # build images + (re)start; run after pulling new code
make deploy-ps     # container status / health
make deploy-logs   # follow api, worker and web logs
```

Only port `47100` is public. Postgres (`127.0.0.1:47102`) and SMTP stay on loopback, so
`make seed` / `make migrate-up` from the host keep working. While the stack runs, ports
47100–47105 are taken: for hot-reload development stop it first (`make deploy-down`, then `make dev`).
See [ADR 0009](docs/adr/0009-always-on-docker-deployment.md).

## Make targets

| Target | What it does |
| --- | --- |
| `make dev` | Dependencies + migrations, then API (air) and Vite in parallel |
| `make deps-up` / `deps-down` | Start/stop Postgres and Mailpit (`docker-compose.dev.yml`) |
| `make migrate-up` / `migrate-down` / `migrate-status` | goose migrations (embedded in the binary) |
| `make migrate-create name=x` | New SQL migration |
| `make gen` | sqlc, Go DTOs, TS client and `docs/API.md` from `api/openapi.yaml` |
| `make gen-check` | Fail if generated code is stale (CI) |
| `make test` | Go tests (testcontainers PostgreSQL) + Vitest |
| `make lint` | go vet, golangci-lint, tsc, ESLint, Prettier |
| `make check` | lint + test |
| `make build` | Static Go binaries in `backend/bin` + web bundle |

## OAuth sign-in (optional)

Create OAuth apps and set `LK_GOOGLE_CLIENT_*` / `LK_GITHUB_CLIENT_*`. The callback URL is
`$LK_PUBLIC_URL/api/v1/auth/oauth/<google|github>/callback`. GitHub accepts the bare IP. Google
requires a hostname (see [ADR 0005](docs/adr/0005-authentication-and-sessions.md)). Buttons for
unconfigured providers are shown disabled.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md) (generated) and [OpenAPI spec](api/openapi.yaml)
- [Design tokens](docs/DESIGN_TOKENS.md)
- [ADRs](docs/adr/)
