# 0013 — Subtasks (and time tracking)

- Status: accepted
- Date: 2026-10-02

## Context

The checklist holds lightweight to-dos inside a card. Teams also need work items that have their own
assignee, due date, status and discussion, but belong to a bigger task.

## Decision — subtasks

A subtask is an ordinary card with `cards.parent_id`:

- one level deep (a subtask cannot be a parent) and always in the parent's project;
- appears on the board, in lists and in filters like any card, with a parent chip; the parent shows
  `done/total` on its tile and in the drawer (`GET /cards?parentId=` lists the children);
- the parent's derived progress (ADR 0010) counts checklist items **and** subtasks together;
- `subtask_total` / `subtask_done` are stored counters refreshed in the same transaction when a
  subtask is created or moved, and after one is deleted;
- deleting a parent archives its subtasks.

Rejected: a trigger-maintained counter (progress needs the Go derivation anyway) and nesting of
arbitrary depth (cycles, recursive progress, harder UI).

## Time tracking

A separate `timetracking` module (table `time_entries`), authorised through the cards module like
comments and attachments:

- an entry is a block of work by one user on one card; a **running** timer has `ended_at IS NULL`
  and its `seconds` are stored when it stops (the API reports elapsed-so-far while it runs);
- a user can have **one** running timer: starting another stops the first, in one transaction
  (enforced by a partial unique index too);
- manual entries are 1 minute – 24 hours, optionally with a note;
- members and above can track time; viewers read. An entry is deleted by its author or an admin;
- the client ticks the running clock locally from `startedAt`; no polling, no realtime events.

Not included yet: estimates and totals on tiles/lists, per-project reports (Performance, phase 8).
