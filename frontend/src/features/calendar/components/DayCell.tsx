import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { parseKey } from '../model/dates';
import { CalendarChip } from './CalendarChip';

interface Props {
  day: string;
  cards: Card[];
  today: string;
  dimmed: boolean;
  /** Max chips before "+N more"; unlimited for the day view. */
  limit: number;
  tall: boolean;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onZoom: (day: string) => void;
  onCreate?: (day: string) => void;
}

export function DayCell({
  day,
  cards,
  today,
  dimmed,
  limit,
  tall,
  canEdit,
  onOpen,
  onZoom,
  onCreate,
}: Props) {
  const { t } = useTranslation('calendar');
  const { setNodeRef, isOver } = useDroppable({ id: day, disabled: !canEdit });
  const isToday = day === today;
  const shown = cards.slice(0, limit);
  const more = cards.length - shown.length;
  const number = parseKey(day).getUTCDate();

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={t('cellLabel', { date: day, count: cards.length })}
      className={cn(
        'group/day flex min-w-0 flex-col gap-1 border-b border-r border-border-subtle p-1.5 transition-colors duration-micro',
        tall ? 'min-h-48' : 'min-h-28',
        dimmed && 'bg-surface-muted/60',
        isOver && 'bg-primary-subtle ring-2 ring-inset ring-primary/50',
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onZoom(day)}
          aria-label={t('openDay', { date: day })}
          className={cn(
            'tabular flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-surface-muted',
            dimmed ? 'text-text-faint' : 'text-text-secondary',
            isToday && 'bg-primary text-white hover:bg-primary',
          )}
        >
          {number}
        </button>
        {canEdit && onCreate && (
          <button
            type="button"
            onClick={() => onCreate(day)}
            aria-label={t('addOn', { date: day })}
            className="rounded px-1 text-sm text-text-faint opacity-0 hover:text-text focus-visible:opacity-100 group-hover/day:opacity-100"
          >
            +
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {shown.map((c) => (
          <li key={c.id}>
            <CalendarChip
              card={c}
              overdue={c.status !== 'done' && day < today}
              onOpen={onOpen}
              draggable={canEdit}
            />
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button
          type="button"
          onClick={() => onZoom(day)}
          className="w-fit rounded px-1 text-xs font-medium text-text-secondary hover:text-text"
        >
          {t('more', { count: more })}
        </button>
      )}
    </div>
  );
}
