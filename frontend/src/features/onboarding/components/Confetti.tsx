import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

const TONES = [
  'bg-series-todo',
  'bg-series-progress',
  'bg-series-review',
  'bg-series-done',
  'bg-primary',
];

/** A short burst of confetti from the middle, once. Decoration only; nothing at all with reduced motion. */
export function Confetti({ count = 26 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
        const dist = 90 + ((i * 37) % 70);
        return {
          i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 30,
          r: (i * 53) % 360,
          tone: TONES[i % TONES.length]!,
          w: 5 + (i % 3) * 2,
        };
      }),
    [count],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-12 size-0">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className={`absolute rounded-xs ${p.tone}`}
          style={{ width: p.w, height: p.w * 1.8 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 90], opacity: [1, 1, 0], rotate: p.r * 2, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.15 + (p.i % 5) * 0.03 }}
        />
      ))}
    </div>
  );
}
