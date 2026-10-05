import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useChangeLanguage } from '@/features/auth';
import { pageTransition } from '@/shared/motion';
import { Skeleton } from '@/shared/ui';
import { LanguageSwitcher } from '../app-shell/header/LanguageSwitcher';
import { ThemeToggle } from '../app-shell/header/ThemeToggle';
import { BrandLogo } from '../app-shell/sidebar/BrandLogo';
import { BoardScene } from './art/BoardScene';
import { DocsScene } from './art/DocsScene';

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-4 h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  );
}

/** Sign-in and friends: one calm card in the middle, a scene in each bottom corner on wide screens. */
export function AuthLayout() {
  const location = useLocation();
  const changeLanguage = useChangeLanguage();
  const reduce = useReducedMotion();
  const rise = (side: 'left' | 'right') => ({
    initial: reduce ? false : { opacity: 0, x: side === 'left' ? -28 : 28, y: 16 },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] as const },
  });
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-bg">
      {/* A quiet wash of brand colour at the top, and a paler one at the foot. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgb(var(--c-primary) / 0.10), transparent 70%), radial-gradient(50% 40% at 50% 100%, rgb(var(--c-review-bar) / 0.07), transparent 70%)',
        }}
      />

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-5">
        <ThemeToggle />
        <LanguageSwitcher onChange={changeLanguage} />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-14 sm:py-16">
        <Link to="/" className="mb-6 rounded-lg [&_span]:text-2xl" aria-label="LecodeKanban">
          <BrandLogo collapsed={false} />
        </Link>
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-7 shadow-lg sm:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Suspense fallback={<FormSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-6 text-xs text-text-muted">© {new Date().getFullYear()} LecodeKanban</p>
      </main>

      {/* The scenes stand in the corners and never reach under the card. */}
      <motion.div
        aria-hidden
        data-testid="auth-scene"
        {...rise('left')}
        className="pointer-events-none absolute bottom-0 left-0 hidden w-[clamp(240px,25vw,430px)] min-[1100px]:block"
      >
        <BoardScene />
      </motion.div>
      <motion.div
        aria-hidden
        data-testid="auth-scene"
        {...rise('right')}
        className="pointer-events-none absolute bottom-0 right-0 hidden w-[clamp(240px,25vw,430px)] min-[1100px]:block"
      >
        <DocsScene />
      </motion.div>
    </div>
  );
}
