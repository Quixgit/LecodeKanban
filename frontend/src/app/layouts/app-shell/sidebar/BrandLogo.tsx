import { AnimatePresence, motion } from 'framer-motion';
import { fade } from '@/shared/motion';

/** Gradient "board" mark + wordmark. Wordmark fades out when collapsed. */
export function BrandLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0 drop-shadow-[0_4px_10px_rgb(76_181_174/0.35)]"
        aria-hidden
      >
        <defs>
          <linearGradient id="lk-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fdcd5" />
            <stop offset="1" stopColor="#36827d" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="10" fill="url(#lk-logo)" />
        <rect x="7" y="8" width="5" height="16" rx="2" fill="#fff" />
        <rect x="13.5" y="8" width="5" height="11" rx="2" fill="#fff" opacity=".85" />
        <rect x="20" y="8" width="5" height="7" rx="2" fill="#fff" opacity=".7" />
      </svg>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            variants={fade}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="whitespace-nowrap text-lg font-semibold tracking-tight text-primary-ink"
          >
            Lecode<span className="text-primary">Kanban</span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
