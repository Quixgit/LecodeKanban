# 0008 — Backend module boundaries and wiring

- Status: accepted
- Date: 2026-10-01

## Decision

- Every module has the same shape: `domain/` (entities, error codes), `repository/` (sqlc `store/`
  - mapping), `service/` (use cases, authorisation), `transport/http/`, `events/`, `module.go`.
- **Ports are defined by the consumer.** `auth` declares the `Users` interface it needs and
  `users/service.Service` happens to satisfy it; `users` never imports `auth`. Where two modules need
  each other (users' HTTP presenter ↔ auth's provider list), `cmd/server/wire.go` breaks the cycle with
  a closure — no globals, no DI container.
- **Cross-module side effects use the in-process event bus** (`auth.user_registered` →
  `workspaces.EnsurePersonal`). Handlers are synchronous and idempotent; listing workspaces also
  self-heals a missing personal workspace.
- **RBAC lives in the workspaces domain** (`rbac.go`, table-tested) and is enforced in services;
  other modules call `workspaces.Service.Authorize(ctx, ws, user, permission)`. Non-members get
  `workspaces.not_found` so workspace existence never leaks.
- **Error codes** are registered with `apperr.Define` and are the API contract; a Go test checks that
  every code has en + uk translations in `frontend/public/locales/*/errors.json`.
- Each module owns its tables; cross-module data is read through services (e.g. member profiles via
  `users.GetMany`), never by joining another module's tables.
