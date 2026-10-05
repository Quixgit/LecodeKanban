# 0010 — Derived task and project progress

- Status: accepted
- Date: 2026-10-01

## Context

Phase 3 let users drag a 0–100 % slider on each task; only "Completed" forced 100 %. The owner
pointed out that a number set by feel says nothing reliable, and project progress (share of
completed tasks) ignored all work in flight.

## Decision

Progress is **computed by the server and read-only** in the API:

| Task state                                  | Progress                                                    |
| ------------------------------------------- | ----------------------------------------------------------- |
| Completed (any column of the `done` status) | 100 %                                                       |
| Has a checklist                             | checked ÷ total, **capped at 99 %**                         |
| No checklist                                | workflow stage: To Do 0 %, In Progress 40 %, In Review 80 % |

Custom columns use the weight of their status. 100 % therefore always means "done". The value
is stored on `cards.progress` (recomputed on move / checklist change) so lists can sort and
filter by it.

Project progress is the **average progress of its live tasks** (stored as `projects.progress`,
refreshed by the same events that maintain `task_count` / `done_count`). An empty project shows
0 %, or 100 % if marked completed.

Migration `00008` recomputes existing tasks with the stage weights.

## Consequences

- No manual progress input anywhere; teams that want finer granularity add checklist items.
- Stage weights are constants in `cards/domain` (`stageProgress`) — one place to tune.
