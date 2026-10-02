import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Kbd, Modal } from '@/shared/ui';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['N'], action: 'newCard' },
  { keys: ['/'], action: 'search' },
  { keys: ['↑', '↓', '←', '→'], action: 'navigate' },
  { keys: ['Enter', 'E'], action: 'open' },
  { keys: ['Space'], action: 'drag' },
  { keys: ['Esc'], action: 'cancel' },
  { keys: ['?'], action: 'help' },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation('kanban');
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={t('shortcuts.title')}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3 text-sm">
        {SHORTCUTS.map((s) => (
          <Fragment key={s.action}>
            <dt className="flex gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dt>
            <dd className="text-text-secondary">{t(`shortcuts.${s.action}`)}</dd>
          </Fragment>
        ))}
      </dl>
    </Modal>
  );
}
