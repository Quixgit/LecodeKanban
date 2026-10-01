# 0003 — Frontend stack and module boundaries

- Status: accepted
- Date: 2026-10-01

## Decision

- **Vite 6 + React 18 + TypeScript strict** (`noUncheckedIndexedAccess` on). React 18 as specified.
- **Tailwind CSS 3** whose theme is generated from CSS variables in `shared/styles/tokens.css`, so
  light/dark switching is a single `data-theme` attribute and never needs `dark:` variants.
- **Radix primitives** for focus management/ARIA (dialog, dropdown, select, tooltip, checkbox,
  switch, avatar); **Framer Motion** for animation; **Lucide** icons; **Zustand** for UI state
  (theme, sidebar, toasts, palette); **TanStack Query** for server state.
- **i18next** with `i18next-http-backend`: namespaces live in `public/locales/{uk,en}/<ns>.json` and
  are lazy-loaded. Language detection: stored choice → browser languages → `en`.
  Plurals use `Intl.PluralRules` (`_one/_few/_many/_other` for Ukrainian).
- **Toasts** are a small in-house Zustand store + Framer stack instead of `@radix-ui/react-toast`,
  to get spring stacking and an imperative `toast.success()` API usable from mutations.
- **Package manager: npm.** The machine's corepack-managed pnpm shim is broken (missing cache), and
  npm needs no global setup for teammates or CI.

### Layering (enforced by ESLint `no-restricted-imports`)

```
pages/      → thin route components, compose features
features/*  → smart modules; public API only via features/<name>/index.ts
shared/     → ui (dumb design system), lib, hooks, i18n, motion, theme, config — leaf layer
app/        → providers, router, AppShell layout; wires features together
```

`shared/` may not import from `features/`, `app/` or `pages/`; nobody may import
`@/features/x/internal/path`. Features receive app-level data via props (e.g. the command palette
gets its command list from the shell) instead of reaching into `app/`.

## Consequences

A feature folder can be deleted with compile errors only at its call sites in `app/`/`pages/`.
