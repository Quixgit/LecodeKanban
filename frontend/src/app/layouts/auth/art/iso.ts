/**
 * A tiny isometric projection for the sign-in artwork. World units are tiles: x runs down to the right, y down to
 * the left, z up. One unit is `S` pixels, so the pictures stay crisp at any size (they are SVG).
 */
export const S = 22;
export const COS = Math.cos(Math.PI / 6);
export const SIN = 0.5;

export interface Origin {
  x: number;
  y: number;
}

export type Pt = readonly [number, number];

export function iso(x: number, y: number, z: number, o: Origin): Pt {
  return [o.x + (x - y) * COS * S, o.y + (x + y) * SIN * S - z * S];
}

export const points = (...p: Pt[]): string =>
  p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

export interface BoxFaces {
  top: string;
  left: string;
  right: string;
}

/** The three faces you can see of a block standing at (x, y, z) that is w × d tiles wide and h tiles high. */
export function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  o: Origin,
): BoxFaces {
  const p = (px: number, py: number, pz: number) => iso(px, py, pz, o);
  return {
    top: points(p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)),
    // The face on the lower left (at the largest y) and the one on the lower right (at the largest x).
    left: points(p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)),
    right: points(p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)),
  };
}

/**
 * The SVG matrix that lays a flat drawing (units in pixels, y down) onto a vertical wall, so rectangles drawn
 * normally look like they are standing in the scene. `edge: 'x'` is a wall running along x (it faces the lower
 * left); `'y'` is a wall running along y (it faces the lower right). (x, y, z) is the wall's top-left corner as
 * seen by the viewer.
 */
export function wall(edge: 'x' | 'y', x: number, y: number, z: number, o: Origin): string {
  const [ox, oy] = iso(x, y, z, o);
  return edge === 'x'
    ? `matrix(${COS} ${SIN} 0 1 ${ox.toFixed(2)} ${oy.toFixed(2)})`
    : `matrix(${COS} ${-SIN} 0 1 ${ox.toFixed(2)} ${oy.toFixed(2)})`;
}
