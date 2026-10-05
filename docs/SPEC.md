# LecodeKanban — build specification

> Recreated from the original build prompt (the file was missing). The reference screenshots live in
> `docs/design/` (an HR template, "LunarDesk": keep its layout, visuals, components and naming; replace
> its HR-specific pages with our domain). Product name in the UI: **LecodeKanban**.

Quality bar: Linear / Height / Trello-premium. Pixel fidelity to the reference design, smooth motion.
Stack: **Go (backend) + React + TypeScript (frontend)**.

## Design (STEP 0)

`docs/DESIGN_TOKENS.md` + `frontend/src/shared/styles/tokens.css`: exact palette (primary teal,
mint-tinted sidebar/background, white cards, text colours, borders); status colours (To Do neutral,
In Progress amber, In Review purple, Completed teal); priority pills (High red, Medium teal, Low
purple); radii (cards ~16–20px, pills fully rounded, inputs ~12px); very soft shadows; spacing scale;
typography (clean geometric sans); thin-stroke Lucide icons; avatar sizes; progress bars; table row
height and borders; sticky header. Light theme (matches screenshots) + dark theme via CSS variables.

## Navigation

Sidebar (collapsible, animated width). MAIN MENU: Dashboard · Projects · Calendar · Tasks (To Do,
In Progress, In Review, Completed) · Performance · Help & Center. WORKSPACE: Team · Integrations ·
Settings. Bottom: announcement card with member avatars and "Join Now" (team meeting link).
Header: page title + subtitle, global search with ⌘K command palette, info, settings, mail (Gmail
shortcut), notifications bell, user menu, language switcher (UK/EN), theme toggle.

## Pages

1. **Login / Register / Forgot password** — split screen, brand teal, animated side, Google and
   GitHub, email + password; validation, error and loading states.
2. **Dashboard** — KPI cards with ± trend chips and count-up, activity feed, recent projects with
   progress, tasks-by-status chart, tasks-completed-per-day heatmap.
3. **Projects** — KPI row (Total / Completed / In Progress / Pending / Overdue), filters (Status, PIC,
   Team, Progress, Deadline), List ⇄ Card toggle, pagination + "Show All".
4. **Tasks** — view switcher **List | Kanban | Calendar**.
   - List: collapsible groups by status with counts, sortable columns, bulk select, "View All".
   - **Kanban**: columns by status (custom allowed), drag & drop between and within columns,
     swimlanes (assignee / project / priority), WIP limits, column collapse, inline quick-add, card
     drawer (description, checklist, labels, assignees, due date, priority, attachments, comments
     with @mentions, activity log, linked GitHub issues/PRs, linked emails, linked calendar event),
     filters, saved views, keyboard shortcuts (N, /, arrows, E …).
   - Calendar: month/week/day, drag a card to change its due date, Google Calendar events overlaid.
5. **Calendar** — full page with Google Calendar two-way sync.
6. **Performance** — velocity, burndown, cycle time, throughput per member/project.
7. **Integrations** — connect/disconnect cards for GitHub, Gmail, Google Calendar (status, scopes,
   last sync, logs).
8. **Settings** — profile, workspace, members & roles (owner/admin/member/viewer), notifications,
   language, theme, API tokens.
9. **Help & Center** — shortcuts cheat sheet, docs links, feedback form.

Added later by the owner: **subtasks** and a **time tracker** on cards (ADR 0013).

## Integrations

Each an isolated module behind a common `Integration` interface.

- **GitHub**: OAuth (optionally a GitHub App); link repo to project; import issues → cards; create
  issue/branch from a card; PR/issue status ↔ column via HMAC-verified webhooks; PR checks on cards.
- **Gmail**: Google OAuth with least-privilege scopes; card from email (button + label rule like
  `Kanban/ToDo`); attach thread link; optional reply; incremental sync via the history API.
- **Google Calendar**: OAuth; card due date/time ⇄ calendar event (two-way, conflict-safe, sync
  tokens, watch channels with renewal); target calendar per project.
- Tokens encrypted at rest (AES-256-GCM, key from env), central refresh, background jobs with
  retries/backoff, idempotent webhooks, per-integration audit log.

## i18n

Ukrainian (uk) and English (en). Every string is a key; per-user language saved in the profile with
auto-detect on first visit; localized dates/numbers/plurals (uk: one/few/many); backend errors are
codes, translated by the client; translation files split by namespace.

## Architecture

Modular monolith; features/modules self-contained and removable; communication only through
interfaces / the internal event bus; no cycles; manual DI in `cmd/server`.

Backend: Go 1.23+, chi, pgx + sqlc, goose, PostgreSQL 16, slog, OpenTelemetry-ready, Prometheus
`/metrics`, `/healthz` + `/readyz`; REST + OpenAPI 3.1 (spec first, generated server types + TS
client); SSE/WebSocket for realtime; fractional indexing for card order; optimistic concurrency
(version/ETag); httpOnly SameSite cookies, short access + rotating refresh, CSRF, argon2id, login
rate limiting, lockout, email verification, password reset; workspace RBAC in the service layer;
validation everywhere, parameterised SQL, CORS allowlist, security headers, secrets from env only,
webhook signature verification; 12-factor config validated at startup; graceful shutdown; tests
(unit, testcontainers integration, ≥70 % service coverage), `golangci-lint` clean.

Frontend: Vite + React 18 + strict TS, React Router, TanStack Query (optimistic DnD), Zustand,
react-hook-form + zod, dnd-kit, Framer Motion, Tailwind driven by CSS-variable tokens, Radix,
Lucide, react-i18next, date-fns (uk/en), TanStack Table + virtualization, Recharts. shared/ui is the
dumb design system; features are smart and imported only via `index.ts`; pages only compose.
Performance: route code splitting, virtualised columns for 1000+ cards, memoised cards. A11y: WCAG
AA, keyboard navigation, ARIA + screen-reader announcements for DnD, focus management,
`prefers-reduced-motion`. Tests: Vitest + Testing Library; Playwright e2e for login, create card,
drag card, switch language, integration mock. ESLint + Prettier + `tsc --noEmit` clean; Storybook
for shared/ui is optional.

## Motion

Easing `cubic-bezier(0.22, 1, 0.36, 1)`; micro 120–150 ms, UI 200–250 ms, large surfaces 300–350 ms;
presets in `shared/motion`. Kanban: lift on drag (scale ≈1.02, deeper shadow, ≤2° rotation), animated
placeholder gap, spring settle, layout animations, enter fade+slide, delete collapses. Sidebar width

- label fade, submenu height, shared-layout nav highlight. Drawer/modal slide + fade + backdrop blur,
  toasts spring. Page transitions subtle; staggered lists (30–40 ms); skeletons matching real layout;
  progress fills; KPI count-up; soft hover elevation; animated segmented control. Animate only
  `transform`/`opacity`.

## Deployment

Multi-stage Dockerfiles (non-root), production `docker-compose.yml` in `/opt/lecodekanban`
(a reverse proxy / Cloudflare handles TLS), healthchecks, named volumes, `.env` for secrets, Postgres
backup script. Make targets: `dev`, `test`, `lint`, `migrate-up`, `gen`, `seed`.

## Phases

1. Tokens + shared/ui + AppShell + i18n + showcase.
2. Backend skeleton: platform, migrations, auth, users, workspaces, login/register end-to-end.
3. Projects + boards + cards, Tasks list, Projects page, Dashboard.
4. Kanban view: DnD, realtime, card drawer, comments, activity.
5. Calendar view + Google Calendar integration.
6. GitHub integration.
7. Gmail integration.
8. Performance analytics, notifications, command palette, Help, polish, a11y.
9. Docker/CI/docs, security review checklist, README.

## Rules

Record decisions as ADRs; never hardcode secrets or UI strings; no TODO stubs in finished phases;
match the screenshots; keep files small (<300 lines where reasonable).
