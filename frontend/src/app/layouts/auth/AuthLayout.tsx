import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useChangeLanguage } from '@/features/auth';
import { pageTransition } from '@/shared/motion';
import { Skeleton } from '@/shared/ui';
import { LanguageSwitcher } from '../app-shell/header/LanguageSwitcher';
import { ThemeToggle } from '../app-shell/header/ThemeToggle';
import { BrandLogo } from '../app-shell/sidebar/BrandLogo';
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

/** Split screen: form on the left, animated brand panel on the right (lg+). */
export function AuthLayout() {
  const location = useLocation();
  const changeLanguage = useChangeLanguage();
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-surface lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="rounded-lg">
            <BrandLogo collapsed={false} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher onChange={changeLanguage} />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">
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
        </main>
        <footer className="text-center text-xs text-text-faint">
          © {new Date().getFullYear()} LecodeKanban
        </footer>
      </div>
      <BrandPanel />
    </div>
  );
}
