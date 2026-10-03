# ADR 0018: Notifications

Status: accepted

## Context

The header bell was a placeholder ("populated by the notifications module") and nothing created
notifications. Task-feed channels also hid their own news from the person who caused it.

## Decision

- A `notifications` module owns a `notifications` table: one row per person and event (assigned,
  task_moved, task_updated, task_commented, mention, dm) with the actor, the card or channel it points at
  and a short title/body. Clients phrase the sentence from `kind`, so rows are translated in the browser.
- Rows are built from other modules' events through the event bus (cards created/updated/moved, comments,
  and the new chat `MessagePosted`), never by reading their tables. The cards module gained `AssigneeIDs`
  and `Brief` for consumers and `CardCreated.Assignees`.
- A person is never notified of their own action. `@channel`/`@here` skip muted members; named mentions do not.
- Browsers learn through a `notification` realtime hint that carries `userId`; the client keys the cache by
  user, so only that person's cache refetches. Hints stay data-free.
- Task-feed messages are authored by the system (`author_id` NULL) with the actor in the payload, so unread
  counts and sounds work for the person who acted.
- Feed channels keep `feed_events` (created, assigned, moved, updated, deleted, commented). An edit that
  both assigns and changes fields counts as both; a task created with people counts as created and assigned.

## Consequences

- No retention policy yet; rows are cheap and indexed by person, workspace and time.
- Offline delivery (email, push) can subscribe to the same events later.
