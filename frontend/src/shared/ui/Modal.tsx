import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { cn } from '../lib/cn';
import { backdrop, scaleIn } from '../motion/presets';
import { CloseButton } from './CloseButton';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

export function Overlay() {
  return (
    <Dialog.Overlay forceMount asChild>
      <motion.div
        variants={backdrop}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-40 bg-overlay/25 backdrop-blur-[3px]"
      />
    </Dialog.Overlay>
  );
}

/** Centered dialog: scale+fade surface over a blurred backdrop; focus is trapped by Radix. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const { t } = useTranslation();
  const restoreFocus = useRestoreFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Overlay />
            <div className="fixed inset-0 z-50 grid grid-cols-1 place-items-center p-4">
              <Dialog.Content
                onCloseAutoFocus={restoreFocus}
                forceMount
                asChild
                {...(description ? {} : { 'aria-describedby': undefined })}
              >
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={cn(
                    'flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-border-subtle bg-surface shadow-lg',
                    widths[size],
                  )}
                >
                  <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-2 pt-5">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-text">
                        {title}
                      </Dialog.Title>
                      {description && (
                        <Dialog.Description className="mt-1 text-base text-text-muted">
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    <Dialog.Close asChild>
                      <CloseButton label={t('actions.close')} />
                    </Dialog.Close>
                  </div>
                  {children && (
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
                  )}
                  {footer && (
                    <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-6 py-4">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
