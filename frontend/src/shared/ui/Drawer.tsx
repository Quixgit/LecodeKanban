import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { cn } from '../lib/cn';
import { drawerRight } from '../motion/presets';
import { IconButton } from './IconButton';
import { Overlay } from './Modal';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra controls rendered next to the close button. */
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  /** No padding and no scrolling: the content manages its own (an embedded chat, for example). */
  flush?: boolean;
  /** Fill the whole screen (the width animates between the preset and full). */
  expanded?: boolean;
}

const widths = { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' } as const;

/** Right-side slide-in panel (used by the card detail drawer). */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  footer,
  width = 'lg',
  flush,
  expanded,
}: DrawerProps) {
  const { t } = useTranslation();
  const restoreFocus = useRestoreFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <Dialog.Content
              onCloseAutoFocus={restoreFocus}
              forceMount
              asChild
              {...(description ? {} : { 'aria-describedby': undefined })}
            >
              <motion.aside
                variants={drawerRight}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border-subtle bg-surface shadow-lg transition-[max-width] duration-large ease-out motion-reduce:transition-none',
                  expanded ? 'max-w-full' : widths[width],
                )}
              >
                <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
                  <div className="min-w-0">
                    <Dialog.Title className="truncate text-lg font-semibold text-text">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-0.5 text-sm text-text-muted">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {actions}
                    <Dialog.Close asChild>
                      <IconButton label={t('actions.close')} variant="ghost" size="sm">
                        <X />
                      </IconButton>
                    </Dialog.Close>
                  </div>
                </header>
                <div
                  className={cn(
                    'min-h-0 flex-1',
                    flush ? 'overflow-hidden' : 'overflow-y-auto px-6 py-5',
                  )}
                >
                  {children}
                </div>
                {footer && (
                  <footer className="border-t border-border-subtle px-6 py-4">{footer}</footer>
                )}
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
