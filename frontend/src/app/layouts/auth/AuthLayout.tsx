import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useChangeLanguage } from '@/features/auth';
import { pageTransition } from '@/shared/motion';
import { Skeleton } from '@/shared/ui';
import { LanguageSwitcher } from '../app-shell/header/LanguageSwitcher';
import { ThemeToggle } from '../app-shell/header/ThemeToggle';
import { BrandLogo } from '../app-shell/sidebar/BrandLogo';
import { AuthBackdrop } from './AuthBackdrop';
import { BrandPanel } from './BrandPanel';

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

/** One shared backdrop: the sign-in card on the left, the product pitch on the right (lg+). */
export function AuthLayout() {
  const location = useLocation();
  const changeLanguage = useChangeLanguage();
  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-bg">
      <AuthBackdrop />
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="rounded-lg">
          <BrandLogo collapsed={false} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher onChange={changeLanguage} />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1240px] flex-1 grid-cols-1 items-center gap-12 px-6 pb-10 sm:px-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:justify-between lg:gap-16">
        <div className="mx-auto w-full max-w-[460px] rounded-3xl border border-border bg-surface/90 p-7 shadow-lg backdrop-blur-sm sm:p-9">
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
        <BrandPanel />
      </main>
      <footer className="pb-6 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} LecodeKanban
      </footer>
    </div>
  );
}
