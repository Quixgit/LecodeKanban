# Architecture

LecodeKanban is a **modular monolith**: a Go backend (phase 2+) and a React SPA, each split into
self-contained modules that talk through public interfaces only. Decisions are recorded in
[`adr/`](adr/).

## Frontend (`frontend/`)

```
src/
├── app/                      composition root
│   ├── App.tsx               RouterProvider + providers
│   ├── router.tsx            route table (lazy pages, title/subtitle handles)
│   ├── providers/            QueryClient, MotionConfig(reducedMotion), Tooltip, Toaster, theme sync
│   └── layouts/app-shell/    Sidebar (nav config, collapse store, announcement), Header
│                             (title, ⌘K trigger, help/settings/mail, notifications, theme, language, user menu)
├── pages/                    thin route components
├── features/                 one folder per feature; public API = index.ts
│   ├── auth/                 session query, login/register/forgot/reset/verify, guards, banner
│   ├── workspaces/           current workspace, Team page, invites, RBAC mirror, switcher
│   ├── command-palette/      ⌘K palette (commands injected by the shell)
│   ├── kanban/ card-drawer/ tasks-list/ time-tracking/ realtime/   Tasks page views, drawer, live updates
│   └── ui-showcase/          living style guide at /ui-kit
├── shared/
│   ├── api/                  openapi-fetch client (CSRF, single-flight refresh + replay), ApiError
│   ├── ui/                   design-system primitives (dumb, token-driven)
│   ├── styles/               tokens.css (light + dark), globals.css
│   ├── motion/               easing, durations, variants, springs
│   ├── i18n/                 i18next init, language helpers
│   ├── theme/                theme store (light/dark/system), <html data-theme> sync
│   ├── hooks/ lib/ config/   hotkeys, media queries, focus restore, formatting, env
└── test/                     Vitest setup, bundled i18n, render helpers
```

**Runtime flow:** `index.html` sets `data-theme` before paint (no flash) → `main.tsx` starts i18n
(HTTP-loaded namespaces) → `App` mounts providers and the router → `AppShell` renders the sidebar,
header and an animated `<Outlet>` with route-level code splitting.

**Theming:** all colours are CSS variables; Tailwind utilities reference them, so one attribute flips
the whole UI. During a switch, `theme-switching` briefly enables colour transitions.

**i18n:** every user-visible string is a key; `public/locales/{en,uk}/{common,nav,errors,auth,team,showcase}.json`.
API errors are translated from their `code` (`errors` namespace); form messages are i18n descriptors
so validation text follows the active language. The profile language wins once signed in, and
switching language while signed in is saved to the profile.

**Session:** `useSession` (TanStack Query) asks `/auth/session`, silently refreshing once on 401;
`RequireAuth`/`GuestOnly` guard routes. The API client refreshes on any 401 (single flight) and
replays the original request from a pristine clone.
A unit test enforces key parity between languages and checks Ukrainian plural forms.

**Accessibility:** Radix handles focus trapping/ARIA; `useRestoreFocus` returns focus to whatever
opened a dialog; skip link; `aria-current` nav; radiogroup semantics for segmented controls;
reduced-motion respected globally.

## Backend (`backend/`)

```
cmd/
├── server/     composition root: wire.go builds every module by hand; main.go runs HTTP + metrics,
│               graceful shutdown, optional embedded worker
├── worker/     background jobs (email delivery, maintenance)
└── migrate/    goose migrations embedded from migrations/
internal/
├── api/        DTOs generated from api/openapi.yaml
├── background/ job handlers + periodic maintenance shared by worker and server
├── platform/   config · logger · apperr · httpx · validation · crypto · authtoken · db · eventbus
│               jobs · mailer · ratelimit · middleware · metrics · testdb
└── modules/
    ├── users/       profiles, credentials storage, lockout counters
    ├── auth/        register/login, rotating refresh sessions, CSRF, verification, reset, OAuth
    ├── workspaces/  workspaces, members, RBAC, invitations
    ├── projects/ boards/ cards/   projects, columns, cards (+ checklists, labels, subtasks)
    ├── comments/ attachments/ activity/   per-card discussion, files, audit feed
    ├── timetracking/  timers and manual time entries per card (ADR 0013)
    ├── wiki/        docs: spaces, folder/page tree, visibility + grants authorizer, trash (ADR 0014)
    └── i18n/        error-code catalog endpoint (+ translation coverage test)
```

**Request path:** chi router → request ID + scoped logger → client IP → access log → recover →
security headers → Prometheus metrics → timeout → `/api/v1` (CORS if configured → CSRF →
authenticate cookie) → public or `RequireAuth` routes → module handler → service (validation,
RBAC) → repository (sqlc/pgx) → PostgreSQL.

**Errors** are `apperr.Error{Code, Fields, Meta}` rendered as `{"error":{"code",…}}`; 5xx causes are
logged with the request ID and never sent to clients.

**Background work** goes through the Postgres job queue (ADR 0006); emails are rendered per user
locale and delivered via SMTP (Mailpit in development).

See ADRs 0005–0008 for auth, jobs, OpenAPI and module-boundary decisions.

## Testing

- Go: table-driven unit tests; services and the HTTP stack are tested against a real PostgreSQL 16
  started by testcontainers (`internal/platform/testdb`); `cmd/server/e2e_test.go` drives the wired
  router with real cookies. Service coverage ≥ 78 %.
- Frontend: Vitest + Testing Library for components, the API client (CSRF, refresh, replay) and
  route guards; locale parity and plural tests.
