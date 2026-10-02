import { CalendarDays, CheckSquare, ListTree, MessageSquare, Paperclip } from 'lucide-react';
import { forwardRef, memo, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { isPast } from '@/shared/lib/dates';
import { formatShortDate } from '@/shared/lib/format';
import { AvatarGroup, Pill, PriorityPill, ProgressBar, type Tone } from '@/shared/ui';

interface Props extends HTMLAttributes<HTMLElement> {
  card: Card;
  /** Rendered in the drag overlay (no focus ring, lifted shadow handled by the wrapper). */
  overlay?: boolean;
}

/** A task on the board. Pure presentation; drag and focus behaviour come from the wrapper. */
export const CardTile = memo(
  forwardRef<HTMLElement, Props>(function CardTile({ card, overlay, className, ...props }, ref) {
    const { t } = useTranslation('kanban');
    const { language } = useLanguage();
    const overdue = card.status !== 'done' && isPast(card.dueDate);
    const showProgress =
      card.status !== 'todo' || card.checklist.total > 0 || card.subtasks.total > 0;
    return (
      <article
        ref={ref}
        className={cn(
          'group/card relative flex select-none flex-col gap-2.5 rounded-lg border border-border-subtle bg-surface p-3.5 text-left shadow-xs',
          'transition-[box-shadow,border-color] duration-micro ease-out',
          !overlay &&
            'hover:border-border hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tabular text-xs font-medium text-text-muted">{card.key}</span>
          <PriorityPill priority={card.priority} size="sm" />
        </div>
        {card.parent && (
          <p className="-mb-1 flex items-center gap-1 text-xs text-text-muted">
            <ListTree className="size-3 shrink-0" aria-hidden />
            <span className="tabular shrink-0">{card.parent.key}</span>
            <span className="truncate">{card.parent.title}</span>
          </p>
        )}
        <h3 className="line-clamp-3 text-base font-medium leading-snug text-text">{card.title}</h3>
        {card.labels.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label={t('card.labels')}>
            {card.labels.map((l) => (
              <li key={l.id}>
                <Pill tone={l.tone as Tone} size="sm" className="h-5 px-2 text-2xs">
                  {l.name}
                </Pill>
              </li>
            ))}
          </ul>
        )}
        {showProgress && (
          <div className="flex items-center gap-2">
            <ProgressBar
              value={card.progress}
              size="sm"
              label={t('card.progress', { value: card.progress })}
            />
            <span className="tabular w-9 text-right text-xs text-text-muted">{card.progress}%</span>
          </div>
        )}
        <footer className="flex items-center gap-3 text-xs text-text-muted">
          {card.dueDate && (
            <span
              className={cn('flex items-center gap-1', overdue && 'font-medium text-danger-ink')}
              title={overdue ? t('card.overdue') : t('card.due')}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {formatShortDate(card.dueDate, language)}
            </span>
          )}
          {card.subtasks.total > 0 && (
            <span
              className={cn(
                'flex items-center gap-1',
                card.subtasks.done === card.subtasks.total && 'text-done-ink',
              )}
              title={t('card.subtasks')}
            >
              <ListTree className="size-3.5" aria-hidden />
              <span className="tabular">
                {card.subtasks.done}/{card.subtasks.total}
              </span>
            </span>
          )}
          {card.checklist.total > 0 && (
            <span
              className={cn(
                'flex items-center gap-1',
                card.checklist.done === card.checklist.total && 'text-done-ink',
              )}
              title={t('card.checklist')}
            >
              <CheckSquare className="size-3.5" aria-hidden />
              <span className="tabular">
                {card.checklist.done}/{card.checklist.total}
              </span>
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="flex items-center gap-1" title={t('card.comments')}>
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="tabular">{card.commentCount}</span>
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span className="flex items-center gap-1" title={t('card.attachments')}>
              <Paperclip className="size-3.5" aria-hidden />
              <span className="tabular">{card.attachmentCount}</span>
            </span>
          )}
          {card.assignees.length > 0 && (
            <AvatarGroup
              className="ml-auto"
              size="xs"
              max={3}
              people={card.assignees.map((a) => ({ name: a.name, src: a.avatarUrl }))}
            />
          )}
        </footer>
      </article>
    );
  }),
);
