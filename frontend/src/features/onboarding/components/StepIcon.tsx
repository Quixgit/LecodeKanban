import { motion, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { transition } from '@/shared/motion';

/** The round badge at the top of a step: it pops in with a spring and carries a soft ring that breathes. */
export function StepIcon({ icon: Icon }: { icon: LucideIcon }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="relative mb-5 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink"
      initial={reduce ? false : { scale: 0.5, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={transition.spring}
    >
      <Icon className="size-7 stroke-[1.6]" />
      {!reduce && (
        <motion.span
          className="absolute inset-0 rounded-2xl ring-2 ring-primary/30"
          animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.span>
  );
}
