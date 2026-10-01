# 0012 — Kanban boards: columns, cross-project lanes and ordering

- Status: accepted
- Date: 2026-10-01

## Context

The Tasks page shows the whole workspace, but columns (custom names, WIP limits) belong to a
project's board. Card order uses fractional keys per column (ADR in phase 3), so keys from
different columns were never compared.

## Decision

**Two board modes** in the Kanban view:

- *Project board* — the project's own columns (custom columns, WIP limits, reordering). Moves
  send `columnId`; neighbours must be in that column.
- *All projects* — one lane per status. Moves send only `status`; neighbours may be cards of
  any project with that status, and the card lands in its project's first column of the status.
  Lane order is `position` across the workspace.

**Keys stay comparable across columns**: new cards are appended after the last key of the whole
status lane (also the end of their column), and every generated key gets a 3-digit random suffix
(`fractional.BetweenUnique`), so independently generated keys practically never collide. If old
data still has equal neighbour keys, a lane move lands right after the tie instead of failing.
Still exactly one row is written per move — no reindexing.

**Columns**: every status keeps at least one column (status ↔ column mapping stays total); only
empty columns can be deleted (archived cards are re-homed to a sibling column first); at most 12
columns; a custom column is inserted after the last column of its status.

**WIP limits are soft**: exceeding one highlights the column and warns on drop but does not
block the move — blocking would stop urgent work and the limit is a team signal, not a rule
the server should enforce.

**Saved views** are personal (`saved_views`), storing an opaque JSON config owned by the
frontend (mode, project, swimlane, filters), max 4 kB, 50 per user and workspace.

## Consequences

- Swimlanes are a client-side grouping; dropping into another lane changes that field
  (priority / primary assignee). Project lanes on the all-projects board are not cross-droppable.
