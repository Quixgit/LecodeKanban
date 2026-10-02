import { CalendarOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { CalendarChip } from './CalendarChip';

const MAX = 50;

/** Cards without a due date: drag one onto a day to schedule it. */
export function Unscheduled({
  cards,
  canEdit,
  onOpen,
}: {
  cards: Card[];
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation('calendar');
  return (
    <aside
      aria-label={t('unscheduled.title')}
      className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-3"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <CalendarOff className="size-4 text-text-muted" aria-hidden />
        {t('unscheduled.title')}
        <span className="tabular text-xs font-normal text-text-muted">{cards.length}</span>
      </h3>
      {cards.length === 0 ? (
        <p className="text-sm text-text-muted">{t('unscheduled.empty')}</p>
      ) : (
        <>
          {canEdit && <p className="text-xs text-text-muted">{t('unscheduled.hint')}</p>}
          <ul className="flex flex-col gap-1.5">
            {cards.slice(0, MAX).map((c) => (
              <li key={c.id}>
                <CalendarChip card={c} overdue={false} onOpen={onOpen} draggable={canEdit} roomy />
              </li>
            ))}
          </ul>
          {cards.length > MAX && (
            <p className="text-xs text-text-muted">
              {t('unscheduled.more', { count: cards.length - MAX })}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
