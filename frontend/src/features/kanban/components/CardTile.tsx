import {
  CalendarClock,
  CalendarDays,
  CheckSquare,
  ListTree,
  MessageSquare,
  Paperclip,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { forwardRef, memo, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { CardFieldChips } from '@/features/custom-fields';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { daysUntil } from '@/shared/lib/dates';
import { formatShortDate } from '@/shared/lib/format';
import {
  AvatarGroup,
  Pill,
  PriorityPill,
  ProgressBar,
  Tooltip,
  statusTone,
  type Tone,
} from '@/shared/ui';

interface Props extends HTMLAttributes<HTMLElement> {
  card: Card;
  /** Rendered in the drag overlay (no focus ring, lifted shadow handled by the wrapper). */
  overlay?: boolean;
}

/** Labels shown before collapsing the rest into "+N". */
const MAX_LABELS = 2;
/** Meta items shown before collapsing the rest into "+N" (keeps the row on one line). */
const MAX_META = 3;

interface MetaItem {
  key: string;
  icon: LucideIcon;
  text: string;
  hint: string;
  tone?: 'danger' | 'warning' | 'done';
}

function Meta({ item }: { item: MetaItem }) {
  const Icon = item.icon;
  return (
    <Tooltip content={item.hint}>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 whitespace-nowrap',
          item.tone === 'danger' && 'font-medium text-danger-ink',
          item.tone === 'warning' && 'font-medium text-progress-ink',
          item.tone === 'done' && 'text-done-ink',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="tabular">{item.text}</span>
      </span>
    </Tooltip>
  );
}

/** A task on the board. Pure presentation; drag and focus behaviour come from the wrapper. */
export const CardTile = memo(
  forwardRef<HTMLElement, Props>(function CardTile({ card, overlay, className, ...props }, ref) {
    const { t } = useTranslation('kanban');
    const { language } = useLanguage();
    const done = card.status === 'done';
    const showProgress = card.status !== 'todo' || card.checklist.total + card.subtasks.total > 0;

    // Fixed order: due · subtasks · checklist · comments · attachments.
    const meta: MetaItem[] = [];
    if (card.dueDate) {
      const days = daysUntil(card.dueDate);
      const overdue = !done && days < 0;
      const soon = !done && days >= 0 && days <= 2;
      meta.push({
        key: 'due',
        icon: overdue ? TriangleAlert : soon ? CalendarClock : CalendarDays,
        text: formatShortDate(card.dueDate, language),
        hint: `${overdue ? `${t('card.overdue')}: ` : `${t('card.due')}: `}${new Intl.DateTimeFormat(language, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(card.dueDate))}`,
        tone: overdue ? 'danger' : soon ? 'warning' : undefined,
      });
    }
    if (card.subtasks.total > 0)
      meta.push({
        key: 'subtasks',
        icon: ListTree,
        text: `${card.subtasks.done}/${card.subtasks.total}`,
        hint: t('card.subtasks'),
        tone: card.subtasks.done === card.subtasks.total ? 'done' : undefined,
      });
    if (card.checklist.total > 0)
      meta.push({
        key: 'checklist',
        icon: CheckSquare,
        text: `${card.checklist.done}/${card.checklist.total}`,
        hint: t('card.checklist'),
        tone: card.checklist.done === card.checklist.total ? 'done' : undefined,
      });
    if (card.commentCount > 0)
      meta.push({
        key: 'comments',
        icon: MessageSquare,
        text: String(card.commentCount),
        hint: t('card.comments'),
      });
    if (card.attachmentCount > 0)
      meta.push({
        key: 'attachments',
        icon: Paperclip,
        text: String(card.attachmentCount),
        hint: t('card.attachments'),
      });
    const shown = meta.slice(0, MAX_META);
    const hidden = meta.slice(MAX_META);
    const labels = card.labels.slice(0, MAX_LABELS);
    const moreLabels = card.labels.slice(MAX_LABELS);
    const hasFooter = meta.length > 0 || card.assignees.length > 0;

    return (
      <article
        ref={ref}
        className={cn(
          'group/card relative flex min-h-[5.5rem] min-w-0 select-none flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3.5 text-left shadow-card',
          'transition-[box-shadow,border-color,transform] duration-micro ease-out',
          !overlay &&
            'hover:-translate-y-px hover:border-border hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tabular font-mono text-xs font-medium text-text-secondary">
            {card.key}
          </span>
          <PriorityPill priority={card.priority} size="sm" className="shrink-0" />
        </div>
        <h3 className="line-clamp-2 min-w-0 text-base font-medium leading-snug text-text [text-wrap:pretty]">
          {card.title}
        </h3>
        {card.parent && (
          <Tooltip content={`${card.parent.key} ${card.parent.title}`}>
            <p className="-mt-1 flex min-w-0 items-center gap-1 text-xs text-text-muted">
              <ListTree className="size-3 shrink-0" aria-hidden />
              <span className="tabular shrink-0">{card.parent.key}</span>
              <span className="truncate">{card.parent.title}</span>
            </p>
          </Tooltip>
        )}
        {card.labels.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label={t('card.labels')}>
            {labels.map((l) => (
              <li key={l.id}>
                <Pill tone={l.tone as Tone} size="sm" className="h-5 px-2 text-2xs">
                  {l.name}
                </Pill>
              </li>
            ))}
            {moreLabels.length > 0 && (
              <li>
                <Tooltip content={moreLabels.map((l) => l.name).join(', ')}>
                  <span className="tabular flex h-5 items-center rounded-full bg-surface-sunken px-2 text-2xs font-medium text-text-secondary">
                    +{moreLabels.length}
                  </span>
                </Tooltip>
              </li>
            )}
          </ul>
        )}
        <CardFieldChips cardId={card.id} />
        {showProgress && (
          <div className="flex items-center gap-2">
            <ProgressBar
              value={card.progress}
              size="sm"
              tone={statusTone[card.status]}
              label={t('card.progress', { value: card.progress })}
            />
            <span className="tabular w-9 shrink-0 text-right text-xs text-text-secondary">
              {card.progress}%
            </span>
          </div>
        )}
        {hasFooter && (
          <footer className="flex min-w-0 items-center gap-3 text-xs text-text-secondary">
            <div className="flex min-w-0 flex-nowrap items-center gap-3 overflow-hidden">
              {shown.map((m) => (
                <Meta key={m.key} item={m} />
              ))}
              {hidden.length > 0 && (
                <Tooltip content={hidden.map((m) => `${m.hint}: ${m.text}`).join(' · ')}>
                  <span className="tabular shrink-0 text-text-muted">+{hidden.length}</span>
                </Tooltip>
              )}
            </div>
            {card.assignees.length > 0 && (
              <AvatarGroup
                className="ml-auto shrink-0"
                size="xs"
                max={3}
                people={card.assignees.map((a) => ({ name: a.name, src: a.avatarUrl }))}
              />
            )}
          </footer>
        )}
      </article>
    );
  }),
);
