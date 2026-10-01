import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightLeft, Flag, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from '@/features/cards';
import { transition } from '@/shared/motion';
import {
  Button,
  ConfirmDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
} from '@/shared/ui';

interface Props {
  count: number;
  busy: boolean;
  onMove: (s: TaskStatus) => void;
  onPriority: (p: Priority) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Floating action bar for the current selection. */
export function BulkBar({ count, busy, onMove, onPriority, onDelete, onClear }: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            role="toolbar"
            aria-label={t('bulk.selected', { count })}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={transition.spring}
            className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-lg"
          >
            <span className="px-2 text-base font-medium text-text" aria-live="polite">
              {t('bulk.selected', { count })}
            </span>
            <span aria-hidden className="h-6 w-px bg-border" />
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>
                  <ArrowRightLeft />
                  {t('bulk.move')}
                </Button>
              </DropdownTrigger>
              <DropdownContent align="center" side="top">
                {STATUSES.map((s) => (
                  <DropdownItem key={s} onSelect={() => onMove(s)}>
                    {t(`common:status.${s}`)}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>
                  <Flag />
                  {t('bulk.priority')}
                </Button>
              </DropdownTrigger>
              <DropdownContent align="center" side="top">
                {PRIORITIES.map((p) => (
                  <DropdownItem key={p} onSelect={() => onPriority(p)}>
                    {t(`common:priority.${p}`)}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger-ink"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              <Trash2 />
              {t('bulk.delete')}
            </Button>
            <IconButton variant="ghost" size="sm" label={t('bulk.clear')} onClick={onClear}>
              <X />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('bulk.confirmTitle', { count })}
        description={t('bulk.confirmBody')}
        confirmLabel={t('bulk.delete')}
        loading={busy}
        onConfirm={() => {
          onDelete();
          setConfirm(false);
        }}
      />
    </>
  );
}
