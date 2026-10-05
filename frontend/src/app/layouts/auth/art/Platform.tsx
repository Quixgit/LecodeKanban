import { box, iso, points, type Origin } from './iso';

/** The slab every scene stands on: a light top with a fine tile grid, and two thick sides in the brand tint. */
export function Platform({ size, o }: { size: number; o: Origin }) {
  const slab = box(0, 0, -1.1, size, size, 1.1, o);
  const lines: string[] = [];
  for (let i = 1; i < size; i++) {
    lines.push(
      `M${iso(i, 0, 0, o).join(' ')} L${iso(i, size, 0, o).join(' ')}`,
      `M${iso(0, i, 0, o).join(' ')} L${iso(size, i, 0, o).join(' ')}`,
    );
  }
  const shadow = points(
    iso(-0.4, size + 0.4, -1.1, o),
    iso(size + 0.4, size + 0.4, -1.1, o),
    iso(size + 0.4, -0.4, -1.1, o),
    iso(size + 1.6, size + 1.6, -1.1, o),
  );
  return (
    <g>
      <polygon points={shadow} className="fill-text/[0.05]" />
      <polygon
        points={slab.left}
        className="fill-primary-soft stroke-primary-border"
        strokeWidth="1"
      />
      <polygon
        points={slab.right}
        className="fill-primary-subtle stroke-primary-border"
        strokeWidth="1"
      />
      <polygon points={slab.top} className="fill-surface stroke-primary-border" strokeWidth="1" />
      <path d={lines.join(' ')} className="stroke-border-subtle" strokeWidth="0.8" fill="none" />
    </g>
  );
}
