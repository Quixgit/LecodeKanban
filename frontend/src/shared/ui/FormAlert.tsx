import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { transition } from '../motion/presets';

/** Inline form-level message (server errors, success notes) with height animation. */
export function FormAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success';
  children?: ReactNode;
}) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck;
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={transition.ui}
          className="overflow-hidden"
        >
          <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm',
              tone === 'error' ? 'bg-danger-soft text-danger-ink' : 'bg-done-soft text-done-ink',
            )}
          >
            <Icon className="mt-px size-4 shrink-0 stroke-2" aria-hidden />
            <span>{children}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
