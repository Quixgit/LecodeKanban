import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { transition } from '../motion';

/** Cards rise into place one after another, like the rest of the platform's pages. */
export function Reveal({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.large, delay: reduce ? 0 : Math.min(index, 8) * 0.06 }}
    >
      {children}
    </motion.div>
  );
}
