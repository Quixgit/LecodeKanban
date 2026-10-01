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
│   ├── command-palette/      ⌘K palette (commands injected by the shell)
│   └── ui-showcase/          living style guide at /ui-kit
├── shared/
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

**i18n:** every user-visible string is a key; `public/locales/{en,uk}/{common,nav,showcase}.json`.
A unit test enforces key parity between languages and checks Ukrainian plural forms.

**Accessibility:** Radix handles focus trapping/ARIA; `useRestoreFocus` returns focus to whatever
opened a dialog; skip link; `aria-current` nav; radiogroup semantics for segmented controls;
reduced-motion respected globally.

## Backend

Arrives in phase 2: `backend/` with `cmd/{server,worker,migrate}`, `internal/platform/*`
(config, db, eventbus, jobs, crypto, realtime…) and `internal/modules/*` each shaped
`domain/ repository/ service/ transport/http/ events/ module.go`, wired manually in `cmd/server`.
