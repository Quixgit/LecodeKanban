import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Pencil, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { useWorkspaceSettings } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';
import { Avatar, Button, IconButton, ProgressBar, Skeleton, toast } from '@/shared/ui';
import type { TimeEntry } from '../api/timeApi';
import { useElapsed, useRunningTimer, useTimeEntries, useTimeMutations } from '../hooks/useTime';
import { clock } from '../model/duration';
import { dayKey } from '../model/week';
import { formatDuration } from '../model/formatDuration';
import { Duration } from './Duration';
import { EstimateButton } from './EstimateButton';
import { LogTimeDialog } from './LogTimeDialog';

const VISIBLE = 5;

/**
 * Time on a task, in the order a person thinks about it: start the clock (or add time you already spent),
 * see how far you are against the estimate, check what was logged.
 */
export function TimeTracker({
  cardId,
  editable,
  currentUserId,
  isAdmin,
}: {
  cardId: string;
  editable: boolean;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { t } = useTranslation('time');
  const { language } = useLanguage();
  const reduce = useReducedMotion();
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const manualAllowed = useWorkspaceSettings(workspace?.id).data?.timeAllowManual ?? true;
  const list = useTimeEntries(cardId);
  const running = useRunningTimer().data ?? null;
  const { start, stop, remove } = useTimeMutations();
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [all, setAll] = useState(false);
  const fmt = (seconds: number) => formatDuration(t, seconds);

  const here = running?.cardId === cardId ? running : null;
  const elapsed = useElapsed(here?.startedAt, !!here);
  const entries = useMemo(() => list.data?.entries ?? [], [list.data]);
  // The server counts a running timer up to the moment of fetching; add what has ticked since.
  const stored = entries.reduce((sum, e) => sum + (e.running ? 0 : e.seconds), 0);
  const total = stored + (here ? elapsed : 0);
  const estimate = list.data?.estimateSeconds ?? null;
  const fail = (e: unknown) => toast.error(errorText(e));

  const pct = estimate ? (total / estimate) * 100 : 0;
  const over = estimate !== null && total > estimate;
  const act = () =>
    here ? stop.mutate(here.id, { onError: fail }) : start.mutate(cardId, { onError: fail });
  const pending = here ? stop.isPending : start.isPending;

  const label = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (dayKey(d) === dayKey(today)) return t('panel.today');
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (dayKey(d) === dayKey(yesterday)) return t('panel.yesterday');
    return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(d);
  };
  const groups = useMemo(() => {
    const out: { day: string; items: TimeEntry[] }[] = [];
    for (const e of entries) {
      const key = dayKey(new Date(e.startedAt));
      const last = out[out.length - 1];
      if (last?.day === key) last.items.push(e);
      else out.push({ day: key, items: [e] });
    }
    return out;
  }, [entries]);
  const shown = all ? entries.length : VISIBLE;
  let counted = 0;

  return (
    <section
      aria-label={t('panel.title')}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text">{t('panel.title')}</h3>
          <p className="tabular text-sm text-text-secondary" aria-live="off">
            {list.isPending ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <>
                <span className="font-semibold text-text">
                  <Duration seconds={total} />
                </span>{' '}
                {t('panel.logged').toLowerCase()}
              </>
            )}
          </p>
        </div>

        {editable && (
          <button
            type="button"
            onClick={act}
            disabled={pending}
            className={cn(
              'relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-base font-medium outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 [&_svg]:size-4 [&_svg]:fill-current',
              here
                ? 'bg-danger-soft text-danger-ink hover:bg-danger-soft/80'
                : 'bg-primary-solid text-on-primary hover:bg-primary-solid-hover',
            )}
          >
            {here ? <Square aria-hidden /> : <Play aria-hidden />}
            <span>{here ? t('panel.stop') : running ? t('switch') : t('panel.start')}</span>
            {here && (
              <span role="timer" aria-label={t('running')} className="tabular font-semibold">
                {clock(elapsed)}
              </span>
            )}
            {here && !reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-danger/10 to-transparent"
                animate={{ x: ['-100%', '500%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </button>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-text-muted">
              {estimate !== null ? (
                <>
                  {t('estimate.title')}{' '}
                  <span className="tabular font-semibold text-text">{fmt(estimate)}</span>
                </>
              ) : (
                t('estimate.none')
              )}
            </span>
            <EstimateButton cardId={cardId} estimate={estimate} editable={editable} />
          </div>
          {estimate !== null && (
            <>
              <ProgressBar
                value={pct}
                tone={over ? 'red' : pct >= 85 ? 'amber' : 'teal'}
                size="sm"
                label={t('estimate.title')}
              />
              <p
                className={cn(
                  'tabular text-xs',
                  over ? 'font-medium text-danger-ink' : 'text-text-secondary',
                )}
              >
                {over
                  ? t('estimate.over', { time: fmt(total - estimate) })
                  : t('estimate.left', { time: fmt(estimate - total) })}
              </p>
            </>
          )}
        </div>

        {editable && manualAllowed && (
          <Button variant="secondary" size="sm" onClick={() => setLogging(true)} className="w-full">
            <Plus />
            {t('panel.logTime')}
          </Button>
        )}
      </div>

      <div className="border-t border-border-subtle">
        {entries.length === 0 && !list.isPending ? (
          <p className="px-4 py-4 text-sm text-text-muted">{t('panel.empty')}</p>
        ) : (
          <ul className="px-2 py-1.5">
            <AnimatePresence initial={false}>
              {groups.map((g) => {
                const rows = g.items.filter(() => counted++ < shown);
                if (rows.length === 0) return null;
                return (
                  <li key={g.day}>
                    <p className="px-2 pb-0.5 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                      {label(rows[0]!.startedAt)}
                    </p>
                    <ul>
                      {rows.map((e) => (
                        <motion.li
                          key={e.id}
                          layout={reduce ? false : 'position'}
                          initial={reduce ? false : { opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={transition.ui}
                          className="group/entry flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-muted"
                        >
                          <Avatar name={e.user?.name ?? '?'} src={e.user?.avatarUrl} size="xs" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-text">
                              {e.note || (
                                <span className="text-text-muted">
                                  {e.user?.name ?? t('someone')}
                                </span>
                              )}
                            </p>
                            {e.note && (
                              <p className="truncate text-xs text-text-muted">
                                {e.user?.name ?? t('someone')}
                              </p>
                            )}
                          </div>
                          <span className="tabular text-sm font-medium text-text">
                            {e.running ? (
                              clock(e.id === here?.id ? elapsed : e.seconds)
                            ) : (
                              <Duration seconds={e.seconds} />
                            )}
                          </span>
                          {editable && !e.running && (e.user?.id === currentUserId || isAdmin) && (
                            <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover/entry:opacity-100">
                              {manualAllowed && (
                                <IconButton
                                  variant="ghost"
                                  size="sm"
                                  label={t('panel.edit')}
                                  onClick={() => setEditing(e)}
                                >
                                  <Pencil />
                                </IconButton>
                              )}
                              <IconButton
                                variant="ghost"
                                size="sm"
                                label={t('delete')}
                                onClick={() => remove.mutate(e.id, { onError: fail })}
                              >
                                <Trash2 />
                              </IconButton>
                            </span>
                          )}
                        </motion.li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {entries.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="w-full border-t border-border-subtle px-4 py-2 text-left text-xs font-medium text-primary-ink hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
          >
            {all ? t('panel.less') : t('entries', { count: entries.length })}
          </button>
        )}
      </div>

      <LogTimeDialog
        open={logging}
        onOpenChange={setLogging}
        task={{ id: cardId, key: '', title: '' }}
      />
      <LogTimeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        task={{ id: cardId, key: '', title: '' }}
        entry={editing ?? undefined}
      />
    </section>
  );
}
