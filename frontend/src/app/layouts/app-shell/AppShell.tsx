import { motion } from 'framer-motion';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import {
  useApplyProfileLanguage,
  useSession,
  useSessionExpiryListener,
  VerificationBanner,
} from '@/features/auth';
import { CommandPalette } from '@/features/command-palette';
import { useWorkspaceEvents } from '@/features/realtime';
import { useCurrentWorkspace } from '@/features/workspaces';
import { pageTransition } from '@/shared/motion';
import { Header } from './header/Header';
import { PageSkeleton } from './PageSkeleton';
import { MobileNav } from './sidebar/MobileNav';
import { Sidebar } from './sidebar/Sidebar';
import { useShellCommands } from './useShellCommands';
import { useViewer } from './useViewer';

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const commands = useShellCommands();
  const viewer = useViewer();
  const { user } = useSession();
  const { workspace } = useCurrentWorkspace();
  useSessionExpiryListener();
  useWorkspaceEvents(workspace?.id); // live updates from teammates, for every page
  useApplyProfileLanguage(user);

  return (
    <div className="flex min-h-dvh bg-bg">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 shadow-md focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('a11y.skipToContent')}
      </a>
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header viewer={viewer} />
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6">
          <VerificationBanner />
          {/* Enter-only: an exit phase around lazy routes can stall and leave a blank, inert page. */}
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="hidden"
            animate="visible"
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <CommandPalette commands={commands} />
    </div>
  );
}
