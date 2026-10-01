import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { transition } from '../motion/presets';
import { useToastStore, type ToastItem } from './toastStore';

const icons = { info: Info, success: CheckCircle2, error: XCircle } as const;
const iconColor = { info: 'text-primary', success: 'text-done', error: 'text-danger' } as const;

function ToastCard({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { t } = useTranslation();
  const Icon = icons[toast.tone];

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, transition: transition.micro }}
      transition={transition.spring}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-[360px] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <Icon
        className={cn('mt-0.5 size-5 shrink-0 stroke-[1.75]', iconColor[toast.tone])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-text">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-sm text-text-muted">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label={t('actions.dismiss')}
        className="rounded-md p-0.5 text-text-faint transition-colors hover:text-text"
      >
        <X className="size-4" />
      </button>
    </motion.li>
  );
}

/** Mount once at the root. Toasts stack bottom-right with spring layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2.5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </ol>
  );
}
