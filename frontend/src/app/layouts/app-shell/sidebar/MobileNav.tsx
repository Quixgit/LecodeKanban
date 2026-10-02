import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { drawerLeft } from '@/shared/motion';
import { Overlay } from '@/shared/ui/Modal';
import { useSidebarStore } from '../sidebarStore';
import { SidebarContent } from './SidebarContent';

/** Off-canvas navigation below the lg breakpoint; opens from the header's menu button. */
export function MobileNav() {
  const { t } = useTranslation('nav');
  const open = useSidebarStore((s) => s.mobileOpen);
  const setOpen = useSidebarStore((s) => s.setMobileOpen);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { pathname, search } = useLocation();

  // Going somewhere closes the drawer; so does growing past the breakpoint.
  useEffect(() => setOpen(false), [pathname, search, setOpen]);
  useEffect(() => {
    if (desktop) setOpen(false);
  }, [desktop, setOpen]);

  return (
    <Dialog.Root open={open && !desktop} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && !desktop && (
          <Dialog.Portal forceMount>
            <Overlay />
            <Dialog.Content forceMount asChild aria-describedby={undefined}>
              <motion.aside
                variants={drawerLeft}
                initial="hidden"
                animate="visible"
                exit="exit"
                aria-label={t('sidebar.label')}
                className="fixed inset-y-0 left-0 z-50 flex w-[17.5rem] max-w-[85vw] flex-col border-r border-border-subtle bg-surface shadow-lg"
              >
                <Dialog.Title className="sr-only">{t('sidebar.label')}</Dialog.Title>
                <SidebarContent collapsed={false} mobile onToggle={() => setOpen(false)} />
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
