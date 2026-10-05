import { motion, useReducedMotion } from 'framer-motion';
import { Person } from './Person';
import { Platform } from './Platform';
import { box, iso, wall, type Origin } from './iso';

const O: Origin = { x: 175, y: 92 };
const SIZE = 9;
const BARS = [38, 62, 46, 84, 70, 98];

/** A wall of charts, a stack of documents, a magnifying glass, and two people reviewing the numbers. */
export function DocsScene() {
  const reduce = useReducedMotion();
  const p1 = iso(3.2, 6.3, 0, O);
  const p2 = iso(5.6, 7.2, 0, O);
  const stack = [
    box(7, 5.6, 0, 1.6, 1.2, 0.5, O),
    box(7.1, 5.7, 0.5, 1.5, 1.1, 0.4, O),
    box(7.2, 5.8, 0.9, 1.4, 1, 0.4, O),
  ];
  const lens = iso(7.4, 3.2, 3, O);
  return (
    <svg viewBox="0 -62 350 402" className="h-auto w-full" aria-hidden focusable="false">
      <Platform size={SIZE} o={O} />

      {/* Charts on a wall at the back right. */}
      <g transform={wall('y', 1.2, 7.8, 6.3, O)}>
        <rect
          x="0"
          y="0"
          width="150"
          height="132"
          rx="7"
          className="fill-surface stroke-border-strong"
          strokeWidth="1.4"
        />
        <rect x="0" y="0" width="150" height="14" rx="7" className="fill-review-bar" />
        <rect x="0" y="8" width="150" height="6" className="fill-review-bar" />
        <g transform="translate(12 26)">
          <rect width="76" height="96" rx="5" className="fill-surface-column" />
          {BARS.map((h, i) => (
            <motion.rect
              key={i}
              x={7 + i * 11}
              y={90 - h * 0.85}
              width="7"
              height={h * 0.85}
              rx="2"
              className={i % 2 ? 'fill-primary' : 'fill-progress-bar'}
              style={{ originY: '90px', originX: `${10 + i * 11}px` }}
              initial={false}
              animate={reduce ? undefined : { scaleY: [1, 0.55, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
            />
          ))}
        </g>
        <g transform="translate(96 26)">
          <rect width="42" height="44" rx="5" className="fill-surface-column" />
          <circle
            cx="21"
            cy="22"
            r="13"
            className="fill-none stroke-border-strong"
            strokeWidth="6"
          />
          <motion.circle
            cx="21"
            cy="22"
            r="13"
            className="fill-none stroke-done"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="82"
            transform="rotate(-90 21 22)"
            initial={false}
            animate={reduce ? { strokeDashoffset: 24 } : { strokeDashoffset: [82, 24, 24, 82] }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.35, 0.8, 1],
            }}
          />
          <rect y="50" width="42" height="46" rx="5" className="fill-surface-column" />
          <path
            d="M6 84 L16 72 L24 78 L34 60 L38 64"
            className="stroke-review-bar"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      </g>

      {/* A stack of documents. */}
      {stack.map((b, i) => (
        <g key={i} strokeWidth="1">
          <polygon points={b.left} className="fill-surface-sunken stroke-border-strong" />
          <polygon points={b.right} className="fill-border stroke-border-strong" />
          <polygon points={b.top} className="fill-surface stroke-border-strong" />
        </g>
      ))}

      <Person x={p1[0]} y={p1[1]} shirt="done" skin={3} hair={0} arm="point" />
      <Person x={p2[0]} y={p2[1]} shirt="progress" skin={1} hair={3} arm="up" wave />

      {/* A magnifying glass floating over the board. */}
      <motion.g
        animate={reduce ? {} : { y: [0, -8, 0], rotate: [0, -4, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: `${lens[0]}px`, originY: `${lens[1]}px` }}
      >
        <line
          x1={lens[0] + 10}
          y1={lens[1] + 12}
          x2={lens[0] + 28}
          y2={lens[1] + 34}
          className="stroke-primary-ink"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle
          cx={lens[0]}
          cy={lens[1]}
          r="17"
          className="fill-primary-soft/70 stroke-primary"
          strokeWidth="5"
        />
      </motion.g>
      <motion.g
        animate={reduce ? {} : { y: [0, -5, 0] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      >
        <rect
          x="262"
          y="40"
          width="44"
          height="30"
          rx="7"
          className="fill-surface stroke-border-strong"
          strokeWidth="1.2"
        />
        <path
          d="M270 62 l8 -9 l7 5 l11 -13"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>
    </svg>
  );
}
