import type { Card, CardMove, Priority, TaskStatus } from '@/features/cards';
import {
  neighbours,
  parseContainer,
  UNASSIGNED,
  type BoardMode,
  type ColumnDef,
  type Swimlane,
} from './board';

/** What a drop asks the server to do: a move, plus a field change when the lane changed. */
export interface MovePlan {
  card: Card;
  move: Omit<CardMove, 'version'>;
  status: TaskStatus;
  columnId?: string;
  lanePatch?: { priority: Priority } | { assigneeIds: string[] };
}

/** Lane changes that are allowed: projects are fixed, priority/assignee follow the lane. */
export function canChangeLane(swimlane: Swimlane, fromLane: string, toLane: string): boolean {
  return fromLane === toLane || swimlane === 'priority' || swimlane === 'assignee';
}

export function planMove(args: {
  card: Card;
  mode: BoardMode;
  swimlane: Swimlane;
  columns: ColumnDef[];
  fromContainer: string;
  toContainer: string;
  /** Final order of the target container (contains card.id). */
  targetIds: string[];
  /** Order of the target container before the drag started. */
  originalIds: string[];
}): MovePlan | null {
  const { card, mode, swimlane, columns, fromContainer, toContainer, targetIds, originalIds } =
    args;
  const from = parseContainer(fromContainer);
  const to = parseContainer(toContainer);
  const col = columns.find((c) => c.key === to.column);
  if (!col) return null;
  if (fromContainer === toContainer && targetIds.join() === originalIds.join()) return null;

  const { afterId, beforeId } = neighbours(targetIds, card.id);
  const move: MovePlan['move'] =
    mode.kind === 'project'
      ? { columnId: col.columnId ?? col.key, afterId, beforeId }
      : { status: col.status, afterId, beforeId };

  let lanePatch: MovePlan['lanePatch'];
  if (from.lane !== to.lane) {
    if (swimlane === 'priority') lanePatch = { priority: to.lane as Priority };
    if (swimlane === 'assignee') {
      const others = card.assignees.map((a) => a.id).filter((id) => id !== from.lane);
      lanePatch = {
        assigneeIds:
          to.lane === UNASSIGNED ? [] : [to.lane, ...others.filter((id) => id !== to.lane)],
      };
    }
  }
  return { card, move, status: col.status, columnId: col.columnId, lanePatch };
}

/** Optimistically reorders the board's card list the way the server will. */
export function applyPlan(
  items: Card[],
  plan: MovePlan,
  people: Record<string, Card['assignees'][number]>,
): Card[] {
  const rest = items.filter((c) => c.id !== plan.card.id);
  const moved: Card = {
    ...plan.card,
    status: plan.status,
    columnId: plan.columnId ?? plan.card.columnId,
  };
  if (plan.lanePatch && 'priority' in plan.lanePatch) moved.priority = plan.lanePatch.priority;
  if (plan.lanePatch && 'assigneeIds' in plan.lanePatch) {
    moved.assignees = plan.lanePatch.assigneeIds.map((id) => people[id]).filter((p) => !!p);
  }
  const { afterId, beforeId } = plan.move;
  let at = rest.length;
  if (beforeId) {
    const i = rest.findIndex((c) => c.id === beforeId);
    if (i >= 0) at = i;
  } else if (afterId) {
    const i = rest.findIndex((c) => c.id === afterId);
    if (i >= 0) at = i + 1;
  }
  rest.splice(at, 0, moved);
  return rest;
}
