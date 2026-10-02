import type { Card, Priority, TaskStatus } from '@/features/cards';

/** "all" = one lane per status across projects; otherwise a project's own board. */
export type BoardMode = { kind: 'all' } | { kind: 'project'; projectId: string };

export type Swimlane = 'none' | 'assignee' | 'project' | 'priority';
export const SWIMLANES: Swimlane[] = ['none', 'assignee', 'project', 'priority'];

export interface ColumnDef {
  /** Column id (project board) or status (all-projects board). */
  key: string;
  name: string;
  status: TaskStatus;
  wipLimit: number | null;
  /** Real column id, when the board has custom columns. */
  columnId?: string;
}

export interface LaneDef {
  key: string;
  kind: Swimlane;
  /** Display data: person, project or priority. */
  title: string;
  avatarUrl?: string | null;
  priority?: Priority;
  tone?: string;
}

export const NO_LANE = '_';
export const UNASSIGNED = 'unassigned';
const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

export function columnKeyOf(card: Card, mode: BoardMode): string {
  return mode.kind === 'project' ? card.columnId : card.status;
}

/** A card belongs to exactly one lane; with several assignees the first (by name) leads. */
export function laneKeyOf(card: Card, swimlane: Swimlane): string {
  switch (swimlane) {
    case 'assignee':
      return card.assignees[0]?.id ?? UNASSIGNED;
    case 'project':
      return card.project.id;
    case 'priority':
      return card.priority;
    default:
      return NO_LANE;
  }
}

/** Lanes present in the cards, in a stable, meaningful order. */
export function buildLanes(cards: Card[], swimlane: Swimlane, unassignedTitle: string): LaneDef[] {
  if (swimlane === 'none') return [{ key: NO_LANE, kind: 'none', title: '' }];
  const lanes = new Map<string, LaneDef>();
  for (const c of cards) {
    const key = laneKeyOf(c, swimlane);
    if (lanes.has(key)) continue;
    if (swimlane === 'assignee') {
      const a = c.assignees[0];
      lanes.set(key, {
        key,
        kind: swimlane,
        title: a?.name ?? unassignedTitle,
        avatarUrl: a?.avatarUrl,
      });
    } else if (swimlane === 'project') {
      lanes.set(key, { key, kind: swimlane, title: c.project.name, tone: c.project.tone });
    } else {
      lanes.set(key, { key, kind: swimlane, title: c.priority, priority: c.priority });
    }
  }
  const out = [...lanes.values()];
  if (swimlane === 'priority') {
    return PRIORITY_ORDER.filter((p) => lanes.has(p)).map((p) => lanes.get(p)!);
  }
  return out.sort((a, b) => {
    if (a.key === UNASSIGNED) return 1;
    if (b.key === UNASSIGNED) return -1;
    return a.title.localeCompare(b.title);
  });
}

/** Droppable container = one column inside one lane. */
export const containerId = (lane: string, column: string) => `${lane}::${column}`;

export function parseContainer(id: string): { lane: string; column: string } {
  const i = id.indexOf('::');
  return { lane: id.slice(0, i), column: id.slice(i + 2) };
}

export type Containers = Record<string, string[]>;

/** Card ids per container, keeping the server's board order (position). */
export function buildContainers(
  cards: Card[],
  columns: ColumnDef[],
  lanes: LaneDef[],
  mode: BoardMode,
  swimlane: Swimlane,
): Containers {
  const out: Containers = {};
  for (const lane of lanes) for (const col of columns) out[containerId(lane.key, col.key)] = [];
  for (const c of cards) {
    const id = containerId(laneKeyOf(c, swimlane), columnKeyOf(c, mode));
    out[id]?.push(c.id);
  }
  return out;
}

export function findContainer(containers: Containers, cardId: string): string | undefined {
  return Object.keys(containers).find((k) => containers[k]!.includes(cardId));
}

/** Moves a card id into a container at index (clamped), returning a new object. */
export function moveItem(
  containers: Containers,
  cardId: string,
  to: string,
  index: number,
): Containers {
  const from = findContainer(containers, cardId);
  if (!from || !(to in containers)) return containers;
  const next = { ...containers, [from]: containers[from]!.filter((id) => id !== cardId) };
  const target = [...next[to]!];
  target.splice(Math.max(0, Math.min(index, target.length)), 0, cardId);
  next[to] = target;
  return next;
}

/** Neighbours of a card in its final container: the server places it between them. */
export function neighbours(ids: string[], cardId: string): { afterId?: string; beforeId?: string } {
  const i = ids.indexOf(cardId);
  if (i < 0) return {};
  return { afterId: ids[i - 1], beforeId: ids[i + 1] };
}

/** Cards per column across all lanes (for WIP limits). */
export function columnCounts(containers: Containers): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, ids] of Object.entries(containers)) {
    const { column } = parseContainer(id);
    out[column] = (out[column] ?? 0) + ids.length;
  }
  return out;
}
