# Audit log of verification

Facts about what was checked, with how. Update on every phase.

## W0 — sidebar and small UI fixes

- Verified: `tsc`, ESLint, Prettier, Vitest (incl. flyout focus/Escape test).
- **Not verified in a browser:** `frontend/e2e/sidebar-collapsed.spec.ts` (icon / highlight centre x
  = rail centre ±0.5 px at 1440 and 1024, light/dark, uk/en, screenshots into
  `docs/qa/sidebar-collapsed/`) is written but has not been run — it needs `make e2e`.
- Seed data in the repository has no junk card titles; the ones seen in the screenshot live in a
  local database and have to be edited or deleted there.

## W1 — wiki backend

- Verified against PostgreSQL 16: `go test -race ./...`, `go vet`, `gofmt`; migration 00011 up/down/up.
- Authorizer matrix: `internal/modules/wiki/domain/authorizer_test.go`.
- Cross-user leak tests (tree, node, access, favorites, recents, shared, trash, create-under, move,
  grant): `internal/modules/wiki/service/service_test.go`; over HTTP: `cmd/server/e2e_wiki_test.go`.
- Not run: `golangci-lint` (the installed binary is older than the module's Go version), Playwright
  and axe (no frontend for the wiki yet).

## W2 — wiki frontend

- Verified against a real stack (local PostgreSQL 16, the API from this branch, Vite): Playwright
  17/17 — sidebar centring (8 viewport/theme/language combinations + flyout), Kanban (5), Docs (3:
  folder → nested page → share → second user sees / doesn't see it → keyboard move → trash →
  restore; drag-and-drop nesting + keyboard navigation; axe wcag2a/2aa on the page and the share
  dialog). Vitest 139, `tsc`, ESLint and Prettier clean; locale parity and literal-key guards pass.
- A bug found by those tests and fixed: opening a just-created page briefly unmounted the tree
  (space unknown while the page loads), dropping the inline rename. The new page is now seeded in the
  query cache and the last space is kept.
- Not covered yet: virtualised tree with 5,000+ nodes (designed for it, not load-tested),
  screen-reader announcements verified only by code review, mobile layout checked by code only.
