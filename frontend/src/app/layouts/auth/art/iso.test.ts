import { describe, expect, it } from 'vitest';
import { COS, S, box, iso, points, wall } from './iso';

const o = { x: 100, y: 50 };

describe('isometric projection', () => {
  it('puts the origin where asked and moves right and left with x and y', () => {
    expect(iso(0, 0, 0, o)).toEqual([100, 50]);
    const [rx, ry] = iso(1, 0, 0, o);
    expect(rx).toBeCloseTo(100 + COS * S);
    expect(ry).toBeCloseTo(50 + 0.5 * S);
    const [lx, ly] = iso(0, 1, 0, o);
    expect(lx).toBeCloseTo(100 - COS * S);
    expect(ly).toBeCloseTo(50 + 0.5 * S);
  });

  it('raises with z', () => {
    expect(iso(0, 0, 2, o)[1]).toBeCloseTo(50 - 2 * S);
  });

  it('builds the three visible faces of a block', () => {
    const b = box(0, 0, 0, 2, 2, 1, o);
    for (const f of [b.top, b.left, b.right]) expect(f.split(' ')).toHaveLength(4);
    // The top face sits one tile higher than the base.
    expect(b.top.split(' ')[0]).toBe(points(iso(0, 0, 1, o)));
  });

  it('lays a flat drawing on a wall', () => {
    expect(wall('x', 0, 0, 0, o)).toBe(`matrix(${COS} 0.5 0 1 100.00 50.00)`);
    expect(wall('y', 0, 0, 0, o)).toBe(`matrix(${COS} -0.5 0 1 100.00 50.00)`);
  });
});
