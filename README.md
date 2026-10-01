# LecodeKanban

A modular Kanban and project-management app: Go backend + React/TypeScript frontend, with GitHub,
Gmail and Google Calendar integrations, in Ukrainian and English.

> **Status: phase 1 of 9.** The design system, app shell (sidebar, header, theme, uk/en) and the
> UI-kit showcase are done. Backend, auth and the product pages arrive in the next phases.
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full layout.

## Quick start (frontend)

Requirements: Node 20.19+ and npm.

```bash
make install   # npm ci in frontend/
make dev       # http://23.19.228.158:47100  (also http://localhost:47100)
```

Then open **`/ui-kit`** for the living style guide, or press <kbd>Ctrl/⌘</kbd>+<kbd>K</kbd>
anywhere for the command palette.

Ports and host come from env (`.env.example`); LecodeKanban uses the **47100–47109** range
([ADR 0004](docs/adr/0004-public-ip-and-port-allocation.md)).

## Make targets

| Target | What it does |
| --- | --- |
| `make dev` | Vite dev server with HMR on `LK_WEB_PORT` (47100) |
| `make build` | Type-check + production build into `frontend/dist` |
| `make preview` | Serve the production build on the same port |
| `make test` | Vitest unit and component tests |
| `make lint` | ESLint (zero warnings) + Prettier check |
| `make typecheck` | `tsc --noEmit` (strict) |
| `make check` | typecheck + lint + test (what CI runs) |

## Docs

- [Design tokens](docs/DESIGN_TOKENS.md): palette, type, radii, shadows and motion, sampled from `docs/design/`
- [Architecture](docs/ARCHITECTURE.md)
- [ADRs](docs/adr/)
