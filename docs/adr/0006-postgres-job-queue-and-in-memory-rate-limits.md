# 0006 — PostgreSQL job queue; Redis deferred

- Status: accepted
- Date: 2026-10-01

## Context

The brief allows "Redis (cache, rate limits, job queue — or Postgres-based queue if simpler)".
Phase 2 needs background email delivery with retries; later phases add sync jobs and webhooks.

## Decision

- **Jobs** live in the `jobs` table and are claimed with `UPDATE … WHERE id IN (SELECT … FOR UPDATE
  SKIP LOCKED)`. Features: idempotency keys (unique partial index), exponential backoff with jitter
  (2ⁿ s, ±20 %, ≤1 h), max attempts, `Permanent` errors, stale-lease recovery, `LISTEN/NOTIFY`
  wake-ups, hourly cleanup of finished jobs. Jobs can be enqueued **inside the same transaction** as
  the business write (outbox semantics).
- The worker runs as `cmd/worker` in production and optionally embedded in the API
  (`LK_EMBEDDED_WORKER=true`) for development.
- **Rate limits** use an in-memory token bucket behind a `ratelimit.Limiter` interface.

## Consequences

- One fewer service to operate; delivery is durable and transactional.
- In-memory limits are per process. When the API is scaled horizontally, add a Redis-backed
  `Limiter` (no call-site changes). Redis will also back caching/realtime fan-out if needed.
