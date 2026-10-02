import { motion } from 'framer-motion';
import { transition } from '@/shared/motion';

/** Shown while the session is resolved on first load (one short request). */
export function BootSplash() {
  return (
    <div className="grid min-h-dvh grid-cols-1 place-items-center bg-bg" aria-busy>
      <motion.svg
        viewBox="0 0 32 32"
        className="size-11 drop-shadow-[0_6px_14px_rgb(76_181_174/0.35)]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...transition.large, delay: 0.15 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="boot-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8fdcd5" />
            <stop offset="1" stopColor="#36827d" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="10" fill="url(#boot-logo)" />
        <rect x="7" y="8" width="5" height="16" rx="2" fill="#fff" />
        <rect x="13.5" y="8" width="5" height="11" rx="2" fill="#fff" opacity=".85" />
        <rect x="20" y="8" width="5" height="7" rx="2" fill="#fff" opacity=".7" />
      </motion.svg>
    </div>
  );
}
