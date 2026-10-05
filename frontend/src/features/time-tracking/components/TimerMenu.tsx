import { Play, Square, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useFeatureEnabled } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  toast,
} from '@/shared/ui';
import { useElapsed, useRunningTimer, useTimeMutations, useTimesheet } from '../hooks/useTime';
import { clock } from '../model/duration';
import { addDays, dayKey, startOfDay } from '../model/week';
import { Duration } from './Duration';

/**
 * The timer in the header, on every page: when one runs it shows the clock; opening it shows the task,
 * a Stop button, today's time and the tasks worked on lately, each one click from a new timer.
 */
export function TimerMenu() {
  const { t } = useTranslation('time');
  const errorText = useErrorText();
  const enabled = useFeatureEnabled('time');
  const { workspace } = useCurrentWorkspace();
  const running = useRunningTimer().data ?? null;
  const elapsed = useElapsed(running?.startedAt, !!running);
  const { start, stop } = useTimeMutations();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState(() => weekRange());
  const sheet = useTimesheet(workspace?.id, range, open);
  const fail = (e: unknown) => toast.error(errorText(e));

  const { today, recent, todayTotal } = useMemo(() => {
    const entries = sheet.data?.entries ?? [];
    const todayKey = dayKey(new Date());
    const todays = entries.filter((e) => dayKey(new Date(e.entry.startedAt)) === todayKey);
    const seen = new Set<string>();
    const lately = [...entries]
      .reverse()
      .filter((e) => (seen.has(e.card.id) ? false : (seen.add(e.card.id), true)))
      .filter((e) => e.card.id !== running?.cardId)
      .slice(0, 5);
    return {
      today: todays,
      recent: lately,
      todayTotal: todays.reduce((n, e) => n + (e.entry.running ? elapsed : e.entry.seconds), 0),
    };
  }, [sheet.data, running?.cardId, elapsed]);
  const runningCard = sheet.data?.entries.find((e) => e.entry.id === running?.id)?.card;

  if (!enabled) return null;
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRange(weekRange());
      }}
    >
      <Tooltip content={t('menu.open')} side="bottom">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={running ? `${t('running')} ${clock(elapsed)}` : t('menu.open')}
            className={cn(
              'inline-flex h-control items-center gap-2 rounded-full text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30',
              running
                ? 'bg-primary-subtle pl-3 pr-3.5 font-medium text-primary-ink hover:bg-primary-soft'
                : 'w-control justify-center text-text-secondary hover:bg-surface-sunken hover:text-text',
            )}
          >
            {running ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                <span role="timer" className="tabular">
                  {clock(elapsed)}
                </span>
              </>
            ) : (
              <Timer className="size-[18px]" aria-hidden />
            )}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0"
      >
        <div className="border-b border-border-subtle p-4">
          {running ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-primary-ink">
                  {t('panel.timerRunning')}
                </p>
                <p className="tabular text-2xl font-semibold text-text">{clock(elapsed)}</p>
                {runningCard ? (
                  <Link
                    to={`/tasks?card=${running.cardId}`}
                    onClick={() => setOpen(false)}
                    className="block truncate text-sm text-text-secondary hover:text-primary hover:underline"
                  >
                    <span className="tabular font-medium">{runningCard.key}</span> ·{' '}
                    {runningCard.title}
                  </Link>
                ) : (
                  <Link
                    to={`/tasks?card=${running.cardId}`}
                    onClick={() => setOpen(false)}
                    className="text-sm text-primary-ink hover:underline"
                  >
                    {t('running')}
                  </Link>
                )}
              </div>
              <Button
                variant="secondary"
                loading={stop.isPending}
                onClick={() =>
                  stop.mutate(running.id, {
                    onSuccess: () => toast.success(t('menu.stopped')),
                    onError: fail,
                  })
                }
              >
                <Square className="fill-current" />
                {t('stop')}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-base font-medium text-text">{t('menu.none')}</p>
              <p className="text-sm text-text-muted">{t('menu.noneHint')}</p>
            </div>
          )}
        </div>
        {recent.length > 0 && (
          <div className="border-b border-border-subtle px-2 py-2">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
              {t('menu.recent')}
            </p>
            <ul>
              {recent.map((e) => (
                <li
                  key={e.card.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{e.card.title}</p>
                    <p className="tabular text-xs text-text-muted">{e.card.key}</p>
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label={t('menu.resume', { key: e.card.key })}
                    onClick={() =>
                      start.mutate(e.card.id, {
                        onSuccess: () => toast.success(t('menu.started')),
                        onError: fail,
                      })
                    }
                  >
                    <Play className="fill-current" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-text-secondary">
            {t('menu.today')}:{' '}
            <span className="tabular font-semibold text-text">
              <Duration seconds={todayTotal} />
            </span>
            {today.length > 0 && <span className="text-text-muted"> · {today.length}</span>}
          </p>
          <Link
            to="/time"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-primary-ink hover:underline"
          >
            {t('menu.openTimesheet')}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The last seven days up to the end of today, in local time. */
function weekRange() {
  const today = startOfDay(new Date());
  return { from: addDays(today, -6).toISOString(), to: addDays(today, 1).toISOString() };
}
