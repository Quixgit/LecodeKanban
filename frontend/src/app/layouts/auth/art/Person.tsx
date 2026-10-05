import { motion, useReducedMotion } from 'framer-motion';

const SKIN = ['#f1c9a5', '#d9a07a', '#a8704c', '#7a4d33'] as const;
const HAIR = ['#2b2b33', '#5a3a22', '#e0b25a', '#8c3b2a'] as const;

export type Shirt = 'todo' | 'progress' | 'review' | 'done' | 'primary';
const SHIRT: Record<Shirt, string> = {
  todo: 'fill-todo stroke-todo',
  progress: 'fill-progress-bar stroke-progress-bar',
  review: 'fill-review-bar stroke-review-bar',
  done: 'fill-done stroke-done',
  primary: 'fill-primary stroke-primary',
};

/** A small flat figure standing with its feet at (x, y). Arms are a single stroke: raised, pointing or resting. */
export function Person({
  x,
  y,
  shirt,
  skin = 0,
  hair = 0,
  arm = 'rest',
  wave = false,
  scale = 1,
}: {
  x: number;
  y: number;
  shirt: Shirt;
  skin?: number;
  hair?: number;
  arm?: 'rest' | 'up' | 'point';
  /** The raised arm moves a little. */
  wave?: boolean;
  scale?: number;
}) {
  const reduce = useReducedMotion();
  const armPath =
    arm === 'up' ? 'M6 -31 L14 -44' : arm === 'point' ? 'M6 -30 L18 -35' : 'M6 -30 L9 -17';
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="11" ry="3.2" className="fill-text/10" />
      <rect x="-5.5" y="-16" width="4.4" height="16" rx="2" fill="#2d3748" />
      <rect x="1.1" y="-16" width="4.4" height="16" rx="2" fill="#2d3748" />
      <rect x="-8.5" y="-35" width="17" height="21" rx="6" className={SHIRT[shirt]} />
      {wave && !reduce ? (
        <motion.path
          d={armPath}
          className={`${SHIRT[shirt]} fill-none`}
          strokeWidth="4.2"
          strokeLinecap="round"
          animate={{ rotate: [0, -10, 0, 8, 0] }}
          style={{ originX: '6px', originY: '-31px' }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <path
          d={armPath}
          className={`${SHIRT[shirt]} fill-none`}
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      )}
      <circle cx="0" cy="-43" r="7.4" fill={SKIN[skin % SKIN.length]} />
      <path
        d="M-7.6 -44 a7.6 7.6 0 0 1 15.2 0 c-3 -3.2 -8.6 -3.6 -15.2 0z"
        fill={HAIR[hair % HAIR.length]}
      />
    </g>
  );
}
