import type { components } from '@/shared/api';
import { rankBetween } from './rank';

export type WikiNode = components['schemas']['WikiTreeNode'];
export type WikiSpace = components['schemas']['WikiSpace'];
export type WikiRole = components['schemas']['WikiRole'];
export type WikiVisibility = components['schemas']['WikiVisibility'];

export type DropPosition = 'before' | 'after' | 'inside';

/** Where a dragged node lands: new parent plus the sibling it goes before or after. */
export interface Placement {
  parentId: string | null;
  beforeId?: string;
  afterId?: string;
}

export interface TreeIndex {
  byId: Map<string, WikiNode>;
  /** Children per parent id; roots (and nothing else) under `null`. Sorted by rank. */
  children: Map<string | null, WikiNode[]>;
  /** Visible nodes whose parent the caller may not see: shown under "Shared with me". */
  detached: WikiNode[];
}

const byRank = (a: WikiNode, b: WikiNode) =>
  a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function buildIndex(nodes: readonly WikiNode[]): TreeIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string | null, WikiNode[]>();
  const detached: WikiNode[] = [];
  for (const n of nodes) {
    if (n.detached) {
      detached.push(n);
      continue;
    }
    const key = n.parentId ?? null;
    const list = children.get(key);
    if (list) list.push(n);
    else children.set(key, [n]);
  }
  for (const list of children.values()) list.sort(byRank);
  detached.sort(byRank);
  return { byId, children, detached };
}

export interface Row {
  node: WikiNode;
  /** 1-based level, as aria-level expects. */
  level: number;
  hasChildren: boolean;
  expanded: boolean;
  posInSet: number;
  setSize: number;
}

/**
 * Visible rows of one space, depth first, honouring the expanded set. Detached nodes (visible to
 * the caller although their parent is not) follow the roots as top-level rows.
 */
export function flatten(index: TreeIndex, expanded: ReadonlySet<string>): Row[] {
  const out: Row[] = [];
  const walk = (parent: string | null, level: number, siblings?: readonly WikiNode[]) => {
    const list = siblings ?? index.children.get(parent) ?? [];
    list.forEach((node, i) => {
      const kids = index.children.get(node.id) ?? [];
      const isOpen = kids.length > 0 && expanded.has(node.id);
      out.push({
        node,
        level,
        hasChildren: kids.length > 0,
        expanded: isOpen,
        posInSet: i + 1,
        setSize: list.length,
      });
      if (isOpen) walk(node.id, level + 1);
    });
  };
  walk(null, 1, [...(index.children.get(null) ?? []), ...index.detached]);
  return out;
}

/** Ancestors from the root down to (excluding) the node; stops at a hidden parent. */
export function ancestors(index: TreeIndex, id: string): WikiNode[] {
  const out: WikiNode[] = [];
  let cur = index.byId.get(id);
  while (cur?.parentId && !cur.detached) {
    const parent = index.byId.get(cur.parentId);
    if (!parent) break;
    out.unshift(parent);
    cur = parent;
  }
  return out;
}

export function isDescendant(index: TreeIndex, id: string, ofId: string): boolean {
  let cur = index.byId.get(id);
  while (cur?.parentId) {
    if (cur.parentId === ofId) return true;
    cur = index.byId.get(cur.parentId);
  }
  return false;
}

/** Number of levels below a node (0 for a leaf). */
export function subtreeHeight(index: TreeIndex, id: string): number {
  const kids = index.children.get(id) ?? [];
  return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => subtreeHeight(index, k.id)));
}

/** The placement a drop at `position` over `target` stands for (inside = last child). */
export function placementFor(
  index: TreeIndex,
  target: WikiNode,
  position: DropPosition,
): Placement {
  if (position === 'inside') {
    const kids = index.children.get(target.id) ?? [];
    const last = kids.at(-1);
    return { parentId: target.id, afterId: last?.id };
  }
  const parentId = target.parentId ?? null;
  return position === 'before'
    ? { parentId, beforeId: target.id }
    : { parentId, afterId: target.id };
}

export interface DropCheck {
  ok: boolean;
  reason?: 'self' | 'cycle' | 'depth';
}

/** Whether `node` may be placed at `placement` (cycles and the space's depth limit). */
export function checkPlacement(
  index: TreeIndex,
  node: WikiNode,
  placement: Placement,
  maxDepth: number,
): DropCheck {
  const { parentId } = placement;
  if (parentId === node.id) return { ok: false, reason: 'self' };
  if (parentId && isDescendant(index, parentId, node.id)) return { ok: false, reason: 'cycle' };
  const parent = parentId ? index.byId.get(parentId) : undefined;
  const newDepth = parent ? parent.depth + 1 : 1;
  if (newDepth + subtreeHeight(index, node.id) > maxDepth) return { ok: false, reason: 'depth' };
  return { ok: true };
}

/** Siblings of a placement excluding the moved node, in order. */
function siblingsAt(index: TreeIndex, parentId: string | null, movedId: string) {
  return (index.children.get(parentId) ?? []).filter((n) => n.id !== movedId);
}

/**
 * Applies a move to a flat node list (for optimistic updates): new parent, a rank between the new
 * neighbours, and depth for the node and its whole subtree. Returns the list unchanged when the
 * placement does not resolve.
 */
export function applyMove(
  nodes: readonly WikiNode[],
  id: string,
  placement: Placement,
): WikiNode[] {
  const index = buildIndex(nodes);
  const node = index.byId.get(id);
  if (!node) return [...nodes];
  const sibs = siblingsAt(index, placement.parentId, id);
  let prev = '';
  let next = '';
  if (placement.afterId !== undefined) {
    const i = sibs.findIndex((s) => s.id === placement.afterId);
    if (i < 0) return [...nodes];
    prev = sibs[i]!.rank;
    next = sibs[i + 1]?.rank ?? '';
  } else if (placement.beforeId !== undefined) {
    const i = sibs.findIndex((s) => s.id === placement.beforeId);
    if (i < 0) return [...nodes];
    next = sibs[i]!.rank;
    prev = sibs[i - 1]?.rank ?? '';
  } else {
    prev = sibs.at(-1)?.rank ?? '';
  }
  const parent = placement.parentId ? index.byId.get(placement.parentId) : undefined;
  const newDepth = parent ? parent.depth + 1 : 1;
  const delta = newDepth - node.depth;
  const moved = new Set<string>();
  const collect = (nid: string) => {
    moved.add(nid);
    for (const k of index.children.get(nid) ?? []) collect(k.id);
  };
  collect(id);
  const rank = rankBetween(prev, next);
  return nodes.map((n) => {
    if (n.id === id)
      return { ...n, parentId: placement.parentId, rank, depth: newDepth, detached: false };
    return moved.has(n.id) ? { ...n, depth: n.depth + delta } : n;
  });
}

/** Keyboard moves (Alt+arrows): the placement for "up", "down", "indent" or "outdent". */
export function keyboardPlacement(
  index: TreeIndex,
  node: WikiNode,
  action: 'up' | 'down' | 'indent' | 'outdent',
): Placement | null {
  const parentId = node.parentId ?? null;
  const sibs = index.children.get(parentId) ?? [];
  const i = sibs.findIndex((s) => s.id === node.id);
  switch (action) {
    case 'up':
      return i > 0 ? { parentId, beforeId: sibs[i - 1]!.id } : null;
    case 'down':
      return i >= 0 && i < sibs.length - 1 ? { parentId, afterId: sibs[i + 1]!.id } : null;
    case 'indent': {
      const prev = sibs[i - 1];
      if (!prev) return null;
      const kids = index.children.get(prev.id) ?? [];
      return { parentId: prev.id, afterId: kids.at(-1)?.id };
    }
    case 'outdent': {
      if (!node.parentId) return null;
      const parent = index.byId.get(node.parentId);
      if (!parent) return null;
      return { parentId: parent.parentId ?? null, afterId: parent.id };
    }
  }
}
