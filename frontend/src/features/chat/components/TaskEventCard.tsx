import {
  ArrowRight,
  ClipboardPlus,
  MessageSquareText,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Button, TaskStatusPill } from '@/shared/ui';
import type { ChatEvent } from '../api/chatApi';

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const;
type Status = (typeof STATUSES)[number];
const isStatus = (s: string | undefined): s is Status =>
  !!s && (STATUSES as readonly string[]).includes(s);

const KIND: Record<ChatEvent['kind'], { icon: LucideIcon; bar: string; chip: string }> = {
  created: { icon: ClipboardPlus, bar: 'bg-done', chip: 'bg-done-soft text-done-ink' },
  moved: { icon: ArrowRight, bar: 'bg-progress', chip: 'bg-progress-soft text-progress-ink' },
  updated: { icon: Pencil, bar: 'bg-review', chip: 'bg-review-soft text-review-ink' },
  deleted: { icon: Trash2, bar: 'bg-danger', chip: 'bg-danger-soft text-danger-ink' },
  commented: {
    icon: MessageSquareText,
    bar: 'bg-primary',
    chip: 'bg-primary-soft text-primary-ink',
  },
};

function StatusFlow({ from, to }: { from?: string; to?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {isStatus(from) && <TaskStatusPill status={from} size="sm" />}
      {isStatus(from) && isStatus(to) && (
        <ArrowRight className="size-3.5 text-text-muted" aria-hidden />
      )}
      {isStatus(to) && <TaskStatusPill status={to} size="sm" />}
    </span>
  );
}

/** A task update in a feed channel: what happened, to which task, with a link to open it. */
export function TaskEventCard({ event: e }: { event: ChatEvent }) {
  const { t } = useTranslation('chat');
  const { icon: Icon, bar, chip } = KIND[e.kind];
  const key = `${e.projectKey}-${e.number}`;
  return (
    <div className="mt-1 max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex">
        <span className={cn('w-1 shrink-0', bar)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium',
                chip,
              )}
            >
              <Icon className="size-3.5 stroke-[1.8]" aria-hidden />
              {t(`feed.kind.${e.kind}`)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <span className="font-mono font-medium text-text-secondary">{e.projectKey}</span>
              <span aria-hidden>·</span>
              <span className="truncate">{e.projectName}</span>
            </span>
          </div>
          <p
            className={cn(
              'text-base font-semibold leading-snug text-text',
              e.kind === 'deleted' && 'line-through decoration-text-faint',
            )}
          >
            <span className="mr-1.5 font-mono text-sm font-medium text-text-muted">{key}</span>
            {e.title}
          </p>

          {e.kind === 'created' && isStatus(e.to) && <StatusFlow to={e.to} />}
          {e.kind === 'moved' && <StatusFlow from={e.from} to={e.to} />}
          {e.kind === 'commented' && e.excerpt && (
            <blockquote className="border-l-2 border-border pl-3 text-sm text-text-secondary">
              {e.excerpt}
            </blockquote>
          )}
          {e.kind === 'updated' && (
            <ul className="space-y-1">
              {(e.changes ?? []).map((c) => (
                <li key={c.field} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="w-20 shrink-0 text-xs font-medium text-text-muted">
                    {t(`feed.field.${c.field}`, { defaultValue: c.field })}
                  </span>
                  <span className="min-w-0 text-text">
                    {c.added || c.removed ? (
                      <>
                        {c.added?.map((x) => (
                          <span
                            key={`+${x}`}
                            className="mr-1.5 rounded bg-done-soft px-1.5 text-done-ink"
                          >
                            + {x}
                          </span>
                        ))}
                        {c.removed?.map((x) => (
                          <span
                            key={`-${x}`}
                            className="mr-1.5 rounded bg-danger-soft px-1.5 text-danger-ink"
                          >
                            − {x}
                          </span>
                        ))}
                      </>
                    ) : (
                      <>
                        {c.from && (
                          <span className="text-text-muted line-through">
                            {valueLabel(c.field, c.from, t)}
                          </span>
                        )}
                        {c.from && c.to && (
                          <ArrowRight className="mx-1 inline size-3 text-text-muted" aria-hidden />
                        )}
                        {c.to
                          ? valueLabel(c.field, c.to, t)
                          : !c.from && <span className="text-text-muted">{t('feed.cleared')}</span>}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {e.kind !== 'deleted' && (
            <div>
              <Button asChild variant="secondary" size="sm">
                <Link to={`/tasks?projectId=${e.projectId}&card=${e.cardId}`}>
                  {t('feed.open')}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function valueLabel(
  field: string,
  v: string,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (field === 'priority') return t(`feed.priority.${v}`, { defaultValue: v });
  if (field === 'dueDate') return v.slice(0, 10);
  return v;
}
