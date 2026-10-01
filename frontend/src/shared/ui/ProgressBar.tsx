import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../lib/cn';
import { transition } from '../motion/presets';
import { progressTone, toneClasses, type Tone } from './tones';

export interface ProgressBarProps {
  value: number;
  /** Defaults to amber below 100% and teal at 100%, like the Projects cards. */
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

/** Rounded progress bar that animates its fill on mount (transform only). */
export function ProgressBar({ value, tone, size = 'md', className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const t = toneClasses[tone ?? progressTone(pct)];
  const reduce = useReducedMotion();
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-full',
        size === 'md' ? 'h-2' : 'h-1.5',
        t.track,
        className,
      )}
    >
      <motion.div
        className={cn('h-full w-full origin-left rounded-full', t.bar)}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: pct / 100 }}
        transition={{ ...transition.large, duration: 0.7 }}
      />
    </div>
  );
}
