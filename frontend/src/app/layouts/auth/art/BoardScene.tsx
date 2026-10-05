import { motion, useReducedMotion } from 'framer-motion';
import { Person } from './Person';
import { Platform } from './Platform';
import { box, iso, wall, type Origin } from './iso';

const O: Origin = { x: 175, y: 92 };
const SIZE = 9;

/** A Kanban board standing on a platform, a card moving between columns, and the people who work on it. */
export function BoardScene() {
  const reduce = useReducedMotion();
  const cols = [0, 1, 2];
  const cards: { col: number; row: number; tone: string }[] = [
    { col: 0, row: 0, tone: 'fill-todo' },
    { col: 0, row: 1, tone: 'fill-todo' },
    { col: 1, row: 0, tone: 'fill-progress-bar' },
    { col: 2, row: 0, tone: 'fill-done' },
    { col: 2, row: 1, tone: 'fill-done' },
  ];
  const p1 = iso(2.6, 5.6, 0, O);
  const p2 = iso(4.8, 6.9, 0, O);
  const p3 = iso(7, 4.6, 0, O);
  const crate = box(0.9, 6.9, 0, 1.4, 1.4, 1.2, O);
  const crate2 = box(1.5, 6.1, 0, 1, 1, 0.9, O);
  const float = reduce ? {} : { y: [0, -7, 0] };
  return (
    <svg viewBox="0 -62 350 402" className="h-auto w-full" aria-hidden focusable="false">
      <Platform size={SIZE} o={O} />

      {/* The board: three columns on a wall at the back left. */}
      <g transform={wall('x', 1.2, 1.2, 6.3, O)}>
        <rect
          x="0"
          y="0"
          width="150"
          height="132"
          rx="7"
          className="fill-surface stroke-border-strong"
          strokeWidth="1.4"
        />
        <rect x="0" y="0" width="150" height="14" rx="7" className="fill-primary" />
        <rect x="0" y="8" width="150" height="6" className="fill-primary" />
        {cols.map((c) => (
          <rect
            key={c}
            x={8 + c * 46}
            y="22"
            width="40"
            height="102"
            rx="5"
            className="fill-surface-column"
          />
        ))}
        {cards.map((k) => (
          <g
            key={`${k.col}-${k.row}`}
            transform={`translate(${12 + k.col * 46} ${28 + k.row * 34})`}
          >
            <rect
              width="32"
              height="28"
              rx="4"
              className="fill-surface stroke-border"
              strokeWidth="1"
            />
            <rect x="4" y="5" width="24" height="3.4" rx="1.7" className={k.tone} />
            <rect x="4" y="12" width="17" height="3" rx="1.5" className="fill-text-faint/60" />
            <rect x="4" y="19" width="9" height="3" rx="1.5" className="fill-border" />
          </g>
        ))}
        {/* A card travelling from To Do to In Review. */}
        <motion.g
          initial={false}
          animate={
            reduce ? undefined : { x: [0, 46, 46, 0], y: [0, 0, 34, 34], opacity: [1, 1, 1, 1] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.7, 1] }}
        >
          <g transform="translate(12 62)">
            <rect
              width="32"
              height="28"
              rx="4"
              className="fill-surface stroke-review-bar"
              strokeWidth="1.6"
            />
            <rect x="4" y="5" width="24" height="3.4" rx="1.7" className="fill-review-bar" />
            <rect x="4" y="12" width="17" height="3" rx="1.5" className="fill-text-faint/60" />
          </g>
        </motion.g>
      </g>

      {/* Crates at the front left. */}
      {[crate, crate2].map((b, i) => (
        <g key={i} strokeWidth="1">
          <polygon points={b.left} className="fill-primary-soft stroke-primary-border" />
          <polygon points={b.right} className="fill-primary-subtle stroke-primary-border" />
          <polygon points={b.top} className="fill-primary-subtle/60 stroke-primary-border" />
        </g>
      ))}

      <Person x={p1[0]} y={p1[1]} shirt="progress" skin={1} hair={0} arm="point" />
      <Person x={p2[0]} y={p2[1]} shirt="review" skin={0} hair={2} arm="up" wave />
      <Person x={p3[0]} y={p3[1]} shirt="primary" skin={2} hair={1} />

      {/* A floating "done" badge. */}
      <motion.g animate={float} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
        <circle cx="288" cy="86" r="18" className="fill-done-soft stroke-done" strokeWidth="1.6" />
        <path
          d="M279 86 l6 6 l12 -13"
          className="stroke-done-ink"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </motion.g>
      <motion.g
        animate={reduce ? {} : { y: [0, -5, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      >
        <rect
          x="40"
          y="96"
          width="40"
          height="26"
          rx="6"
          className="fill-surface stroke-border-strong"
          strokeWidth="1.2"
        />
        <rect x="47" y="104" width="26" height="3.4" rx="1.7" className="fill-progress-bar" />
        <rect x="47" y="111" width="18" height="3" rx="1.5" className="fill-text-faint/60" />
      </motion.g>
    </svg>
  );
}
