# 0007 — OpenAPI 3.0.3 as the contract, generated DTOs and client

- Status: accepted
- Date: 2026-10-01

## Decision

`api/openapi.yaml` is the source of truth. `make gen` produces:

- Go DTOs (`backend/internal/api/types.gen.go`) with **oapi-codegen** (models only; handlers stay
  hand-written chi handlers so modules keep their own routing and middleware);
- the TypeScript schema (`frontend/src/shared/api/schema.gen.ts`) with **openapi-typescript**, used by
  the typed **openapi-fetch** client;
- `docs/API.md`.

The spec is **OpenAPI 3.0.3**, not 3.1: oapi-codegen's 3.1 support is incomplete, and nothing we use
needs 3.1 features. Generator versions are pinned as Go `tool` dependencies and npm devDependencies;
CI runs `make gen-check` to fail on drift. Email fields are plain strings (no `format: email`) so
validation produces translatable field errors instead of decode failures.

## Consequences

Contract changes are reviewed in one YAML file and propagate to both sides at compile time.
