import { Play, Plus, Square, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { Avatar, Button, IconButton, Skeleton, toast } from '@/shared/ui';
import { useElapsed, useRunningTimer, useTimeEntries, useTimeMutations } from '../hooks/useTime';
import { clock, parseDuration } from '../model/duration';
import { Duration } from './Duration';

const input =
  'h-9 min-w-0 rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

/** Time spent on a card: start/stop timer, manual entries and the log. */
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
  const errorText = useErrorText();
  const list = useTimeEntries(cardId);
  const running = useRunningTimer().data ?? null;
  const { start, stop, log, remove } = useTimeMutations();
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState(false);

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-2xl font-semibold tabular-nums text-text" aria-live="off">
          {list.isPending ? (
            <Skeleton className="h-8 w-24 rounded-md" />
          ) : (
            <Duration seconds={total} />
          )}
        </p>
        {here && (
          <span
            role="timer"
            aria-label={t('running')}
            className="tabular flex items-center gap-2 rounded-full bg-primary-subtle px-3 py-1 text-sm font-medium text-primary-ink"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {clock(elapsed)}
          </span>
        )}
        {editable &&
          (here ? (
            <Button
              size="sm"
              variant="secondary"
              loading={stop.isPending}
              onClick={() => stop.mutate(here.id, { onError: fail })}
            >
              <Square />
              {t('stop')}
            </Button>
          ) : (
            <Button
              size="sm"
              loading={start.isPending}
              onClick={() => start.mutate(cardId, { onError: fail })}
            >
              <Play />
              {running ? t('switch') : t('start')}
            </Button>
          ))}
      </div>
      {editable && (
        <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
          <div className="flex flex-col gap-1">
            <input
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                setInvalid(false);
              }}
              placeholder={t('durationPlaceholder')}
              aria-label={t('durationLabel')}
              aria-invalid={invalid}
              className={`${input} w-32 aria-[invalid=true]:border-danger`}
            />
            {invalid && <p className="text-xs text-danger-ink">{t('durationInvalid')}</p>}
          </div>
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('notePlaceholder')}
            aria-label={t('note')}
            className={`${input} flex-1 basis-40`}
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
      )}
      {entries.length > 0 && (
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li
              key={e.id}
              className="group/entry flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-muted"
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
        </ul>
      )}
    </div>
  );
}
