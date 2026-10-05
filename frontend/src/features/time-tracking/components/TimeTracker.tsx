import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, ListChecks, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceSettings } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { collapse } from '@/shared/motion/presets';
import { cn } from '@/shared/lib/cn';
import { Avatar, Button, IconButton, Skeleton, toast } from '@/shared/ui';
import { useElapsed, useRunningTimer, useTimeEntries, useTimeMutations } from '../hooks/useTime';
import { clock, parseDuration } from '../model/duration';
import { Duration } from './Duration';

const input =
  'h-9 min-w-0 rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Time spent on a card, as a compact timer card for the side panel: start/stop, manual entries, the log. */
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
  const { workspace } = useCurrentWorkspace();
  const manualAllowed = useWorkspaceSettings(workspace?.id).data?.timeAllowManual ?? true;
  const { language } = useLanguage();
  const errorText = useErrorText();
  const list = useTimeEntries(cardId);
  const running = useRunningTimer().data ?? null;
  const { start, stop, log, remove } = useTimeMutations();
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [panel, setPanel] = useState<'log' | 'entries' | null>(null);
  const toggle = (next: 'log' | 'entries') => setPanel((p) => (p === next ? null : next));

  const here = running?.cardId === cardId ? running : null;
  const elapsed = useElapsed(here?.startedAt, !!here);
  const entries = list.data?.entries ?? [];
  // The server's total counts the running timer up to the moment of fetching; add what ticked since.
  const stored = entries.reduce((sum, e) => sum + (e.running ? 0 : e.seconds), 0);
  const total = stored + (here ? elapsed : 0);
  const fail = (e: unknown) => toast.error(errorText(e));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seconds = parseDuration(duration);
    if (seconds === null || seconds < 60 || seconds > 86_400) {
      setInvalid(true);
      return;
    }
    log.mutate(
      { cardId, seconds, note: note.trim() },
      {
        onSuccess: () => {
          setDuration('');
          setNote('');
          setInvalid(false);
          toast.success(t('logged'));
        },
        onError: fail,
      },
    );
  };

  const label = here ? t('stop') : running ? t('switch') : t('start');
  const pending = here ? stop.isPending : start.isPending;
  const act = () =>
    here ? stop.mutate(here.id, { onError: fail }) : start.mutate(cardId, { onError: fail });

  return (
    <div className="overflow-hidden rounded-xl border border-primary-border bg-primary-subtle">
      <div className="flex items-center gap-3 p-3">
        {editable && (
          <button
            type="button"
            onClick={act}
            disabled={pending}
            aria-label={label}
            title={label}
            className={cn(
              'relative grid size-11 shrink-0 place-items-center rounded-full text-on-primary outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 [&_svg]:size-4 [&_svg]:fill-current',
              'bg-primary-solid hover:bg-primary-solid-hover',
            )}
          >
            {here && (
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full bg-primary/40 motion-reduce:animate-none"
              />
            )}
            <span className="relative">
              {here ? <Square /> : <Play className="translate-x-px" />}
            </span>
          </button>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-ink">
            <Clock className="size-3.5" aria-hidden />
            {t('title')}
          </p>
          <p className="text-xl font-semibold tabular-nums leading-tight text-text" aria-live="off">
            {list.isPending ? (
              <Skeleton className="mt-1 h-6 w-20 rounded-md" />
            ) : (
              <Duration seconds={total} />
            )}
          </p>
          {here && (
            <p
              role="timer"
              aria-label={t('running')}
              className="tabular mt-0.5 text-xs font-medium text-primary-ink"
            >
              {clock(elapsed)}
            </p>
          )}
        </div>
      </div>
      <div className="flex border-t border-primary-border/70 text-xs font-medium text-primary-ink">
        {editable && manualAllowed && (
          <button
            type="button"
            aria-expanded={panel === 'log'}
            onClick={() => toggle('log')}
            className="flex flex-1 items-center justify-center gap-1.5 px-2 py-2 outline-none transition-colors duration-micro hover:bg-primary-soft focus-visible:bg-primary-soft"
          >
            <Plus className="size-3.5" aria-hidden />
            {t('log')}
          </button>
        )}
        {entries.length > 0 && (
          <button
            type="button"
            aria-expanded={panel === 'entries'}
            onClick={() => toggle('entries')}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-2 py-2 outline-none transition-colors duration-micro hover:bg-primary-soft focus-visible:bg-primary-soft',
              editable && 'border-l border-primary-border/70',
            )}
          >
            <ListChecks className="size-3.5" aria-hidden />
            {t('entries', { count: entries.length })}
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-ui',
                panel === 'entries' && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {panel === 'log' && editable && manualAllowed && (
          <motion.div
            key="log"
            variants={collapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden bg-surface"
          >
            <form onSubmit={submit} className="flex flex-col gap-2 p-3">
              <input
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value);
                  setInvalid(false);
                }}
                placeholder={t('durationPlaceholder')}
                aria-label={t('durationLabel')}
                aria-invalid={invalid}
                className={`${input} w-full aria-[invalid=true]:border-danger`}
              />
              {invalid && <p className="text-xs text-danger-ink">{t('durationInvalid')}</p>}
              <input
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                aria-label={t('note')}
                className={`${input} w-full`}
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={log.isPending}
                disabled={!duration.trim()}
              >
                <Plus />
                {t('log')}
              </Button>
            </form>
          </motion.div>
        )}
        {panel === 'entries' && entries.length > 0 && (
          <motion.ul
            key="entries"
            variants={collapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="scroll-quiet max-h-64 overflow-y-auto bg-surface px-2 py-1"
          >
            {entries.map((e) => (
              <li
                key={e.id}
                className="group/entry flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-surface-muted"
              >
                <Avatar name={e.user?.name ?? '?'} src={e.user?.avatarUrl} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">
                    <span className="font-medium">{e.user?.name ?? t('someone')}</span>
                    {e.note && <span className="text-text-secondary"> · {e.note}</span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {e.running ? t('running') : formatRelative(e.startedAt, language)}
                    {e.manual && ` · ${t('manual')}`}
                  </p>
                </div>
                <span className="tabular text-sm font-medium text-text">
                  {e.running ? (
                    clock(e.id === here?.id ? elapsed : e.seconds)
                  ) : (
                    <Duration seconds={e.seconds} />
                  )}
                </span>
                {editable && !e.running && (e.user?.id === currentUserId || isAdmin) && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    label={t('delete')}
                    onClick={() => remove.mutate(e.id, { onError: fail })}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
