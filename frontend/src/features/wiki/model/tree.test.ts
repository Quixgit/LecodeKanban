import { describe, expect, it } from 'vitest';
import { rankBetween } from './rank';
import {
  ancestors,
  applyMove,
  buildIndex,
  checkPlacement,
  flatten,
  keyboardPlacement,
  placementFor,
  subtreeHeight,
  type WikiNode,
} from './tree';

const node = (
  id: string,
  parentId: string | null,
  rank: string,
  depth: number,
  extra = {},
): WikiNode =>
  ({
    id,
    parentId,
    rank,
    depth,
    title: id,
    kind: 'page',
    spaceId: 's',
    detached: false,
    icon: '',
    cover: '',
    ownerId: 'u',
    favorite: false,
    visibility: null,
    access: { role: 'owner', via: 'owner', visibility: 'private', visibilitySourceId: 's' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...extra,
  }) as WikiNode;

const sample = () => [
  node('a', null, 'a', 1),
  node('b', null, 'b', 1),
  node('a1', 'a', 'a', 2),
  node('a2', 'a', 'b', 2),
  node('a1x', 'a1', 'a', 3),
  node('g', 'hidden', 'a', 2, { detached: true, parentId: null }),
];

describe('rankBetween', () => {
  it.each([
    ['', ''],
    ['a', ''],
    ['', 'b'],
    ['a', 'b'],
    ['a', 'a1'],
    ['az', 'b'],
    ['b', 'a'], // tie/out of order falls back to "after a"
  ])('between(%j, %j) sorts after a and before b', (a, b) => {
    const k = rankBetween(a, b);
    expect(k > a).toBe(true);
    if (b !== '' && a < b) expect(k < b).toBe(true);
  });

  it('can be repeated between the same neighbours', () => {
    let hi = 'b';
    for (let i = 0; i < 20; i++) {
      const k = rankBetween('a', hi);
      expect(k > 'a' && k < hi).toBe(true);
      hi = k;
    }
  });
});

describe('buildIndex / flatten', () => {
  it('keeps detached nodes out of the tree and orders siblings by rank', () => {
    const idx = buildIndex(sample());
    expect(idx.detached.map((d) => d.id)).toEqual(['g']);
    expect(idx.children.get(null)!.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('shows children only for expanded parents, with ARIA positions', () => {
    const idx = buildIndex(sample());
    expect(flatten(idx, new Set()).map((r) => r.node.id)).toEqual(['a', 'b', 'g']);
    const rows = flatten(idx, new Set(['a', 'a1']));
    expect(rows.map((r) => [r.node.id, r.level, r.posInSet, r.setSize])).toEqual([
      ['a', 1, 1, 3],
      ['a1', 2, 1, 2],
      ['a1x', 3, 1, 1],
      ['a2', 2, 2, 2],
      ['b', 1, 2, 3],
      ['g', 1, 3, 3],
    ]);
  });
});

describe('ancestors / height', () => {
  it('walks up to the root', () => {
    expect(ancestors(buildIndex(sample()), 'a1x').map((x) => x.id)).toEqual(['a', 'a1']);
  });
  it('measures subtree height', () => {
    const idx = buildIndex(sample());
    expect(subtreeHeight(idx, 'a')).toBe(2);
    expect(subtreeHeight(idx, 'b')).toBe(0);
  });
});

describe('placements', () => {
  const idx = buildIndex(sample());
  it('maps drop positions to placements', () => {
    expect(placementFor(idx, idx.byId.get('a1')!, 'before')).toEqual({
      parentId: 'a',
      beforeId: 'a1',
    });
    expect(placementFor(idx, idx.byId.get('a1')!, 'after')).toEqual({
      parentId: 'a',
      afterId: 'a1',
    });
    expect(placementFor(idx, idx.byId.get('a')!, 'inside')).toEqual({
      parentId: 'a',
      afterId: 'a2',
    });
    expect(placementFor(idx, idx.byId.get('b')!, 'inside')).toEqual({
      parentId: 'b',
      afterId: undefined,
    });
  });

  it('rejects cycles and depth overflow', () => {
    const a = idx.byId.get('a')!;
    expect(checkPlacement(idx, a, { parentId: 'a' }, 12).reason).toBe('self');
    expect(checkPlacement(idx, a, { parentId: 'a1x' }, 12).reason).toBe('cycle');
    expect(checkPlacement(idx, a, { parentId: 'b' }, 12).ok).toBe(true);
    // a has 2 levels below: under b (depth 1) it would reach depth 4
    expect(checkPlacement(idx, a, { parentId: 'b' }, 3).reason).toBe('depth');
  });

  it('computes keyboard moves', () => {
    const a2 = idx.byId.get('a2')!;
    expect(keyboardPlacement(idx, a2, 'up')).toEqual({ parentId: 'a', beforeId: 'a1' });
    expect(keyboardPlacement(idx, a2, 'down')).toBeNull();
    expect(keyboardPlacement(idx, a2, 'indent')).toEqual({ parentId: 'a1', afterId: 'a1x' });
    expect(keyboardPlacement(idx, a2, 'outdent')).toEqual({ parentId: null, afterId: 'a' });
    expect(keyboardPlacement(idx, idx.byId.get('a')!, 'outdent')).toBeNull();
    expect(keyboardPlacement(idx, idx.byId.get('a')!, 'indent')).toBeNull();
  });
});

describe('applyMove (optimistic)', () => {
  it('re-parents a subtree and fixes depths', () => {
    const next = applyMove(sample(), 'a1', { parentId: 'b' });
    const idx = buildIndex(next);
    expect(idx.children.get('b')!.map((x) => x.id)).toEqual(['a1']);
    expect(idx.byId.get('a1')!.depth).toBe(2);
    expect(idx.byId.get('a1x')!.depth).toBe(3);
    expect(idx.children.get('a')!.map((x) => x.id)).toEqual(['a2']);
  });

  it('orders between neighbours', () => {
    const next = applyMove(sample(), 'b', { parentId: null, beforeId: 'a' });
    expect(
      buildIndex(next)
        .children.get(null)!
        .map((x) => x.id),
    ).toEqual(['b', 'a']);
    const again = applyMove(next, 'a2', { parentId: 'a', beforeId: 'a1' });
    expect(
      buildIndex(again)
        .children.get('a')!
        .map((x) => x.id),
    ).toEqual(['a2', 'a1']);
  });

  it('leaves the list alone when the reference sibling is unknown', () => {
    expect(applyMove(sample(), 'a1', { parentId: 'b', afterId: 'nope' })).toEqual(sample());
  });
});
