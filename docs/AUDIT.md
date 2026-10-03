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
