import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { CommandPalette } from '@/features/command-palette';
import { pageTransition } from '@/shared/motion';
import { Header } from './header/Header';
import { PageSkeleton } from './PageSkeleton';
import { Sidebar } from './sidebar/Sidebar';
import { useShellCommands } from './useShellCommands';
import { useViewer } from './useViewer';

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const commands = useShellCommands();
  const viewer = useViewer();

  return (
    <div className="flex min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('a11y.skipToContent')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header viewer={viewer} />
        <main id="main" tabIndex={-1} className="flex-1 p-6 outline-none">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette commands={commands} />
    </div>
  );
}
