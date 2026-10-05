import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Button, DateInput, Field, Input, Modal, toast } from '@/shared/ui';
import { useTimeMutations } from '../hooks/useTime';
import { parseDuration } from '../model/duration';
import { dayKey, entryStart, fitStart } from '../model/week';
import { TaskPicker, type PickedTask } from './TaskPicker';

const QUICK = [
  { label: '15m', seconds: 900 },
  { label: '30m', seconds: 1800 },
  { label: '1h', seconds: 3600 },
  { label: '2h', seconds: 7200 },
  { label: '4h', seconds: 14400 },
  { label: '8h', seconds: 28800 },
];

export interface EditableEntry {
  id: string;
  seconds: number;
  note: string;
  startedAt: string;
}

/** Log time (or edit an entry): how long, on which day, and what for. The task is fixed, or picked here. */
export function LogTimeDialog({
  open,
  onOpenChange,
  task,
  entry,
  day,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed task; without it the person picks one. */
  task?: PickedTask;
  /** Edit this entry instead of adding one. */
  entry?: EditableEntry;
  /** The day the entry is for; today by default. */
  day?: Date;
}) {
  const { t } = useTranslation('time');
  const errorText = useErrorText();
  const { log, update } = useTimeMutations();
  const [picked, setPicked] = useState<PickedTask | null>(task ?? null);
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(dayKey(day ?? new Date()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start fresh each time the dialog opens, from the entry being edited or from the day asked for.
  useEffect(() => {
    if (!open) return;
    setPicked(task ?? null);
    setError(null);
    if (entry) {
      setDuration(hm(entry.seconds));
      setDate(dayKey(new Date(entry.startedAt)));
      setNote(entry.note);
    } else {
      setDuration('');
      setDate(dayKey(day ?? new Date()));
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const seconds = parseDuration(duration);
  const pending = log.isPending || update.isPending;

  const submit = () => {
    if (!entry && !picked) return setError(t('dialog.noTask'));
    if (seconds === null || seconds < 60 || seconds > 86_400) return setError(t('durationInvalid'));
    const [y, m, d] = date.split('-').map(Number);
    const chosen = new Date(y!, m! - 1, d!);
    const sameDayAsEntry = entry && dayKey(new Date(entry.startedAt)) === date;
    const startedAt = (
      sameDayAsEntry ? fitStart(new Date(entry.startedAt), seconds) : entryStart(chosen, seconds)
    ).toISOString();
    if (new Date(startedAt).getTime() + seconds * 1000 > Date.now() + 60_000)
      return setError(t('dialog.future'));
    const done = (message: string) => () => {
      toast.success(message);
      onOpenChange(false);
    };
    if (entry) {
      update.mutate(
        { id: entry.id, seconds, note: note.trim(), startedAt },
        { onSuccess: done(t('dialog.updated')), onError: (e) => setError(errorText(e)) },
      );
    } else {
      log.mutate(
        { cardId: picked!.id, seconds, note: note.trim(), startedAt },
        { onSuccess: done(t('logged')), onError: (e) => setError(errorText(e)) },
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={entry ? t('dialog.editTitle') : t('dialog.title')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('dialog.cancel')}
          </Button>
          <Button onClick={submit} loading={pending}>
            {t('dialog.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {!entry && (
          <Field label={t('dialog.task')}>
            <TaskPickerField value={picked} onChange={setPicked} />
          </Field>
        )}
        <Field
          label={t('dialog.duration')}
          error={error ?? undefined}
          hint={t('durationPlaceholder')}
        >
          <Input
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setError(null);
            }}
            placeholder={t('durationPlaceholder')}
            autoFocus
            autoComplete="off"
          />
        </Field>
        <div role="group" aria-label={t('dialog.quick')} className="-mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setDuration(q.label);
                setError(null);
              }}
              className={cn(
                'h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                seconds === q.seconds
                  ? 'border-primary-border bg-primary-subtle text-primary-ink'
                  : 'border-border text-text-secondary hover:bg-surface-sunken',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
        <Field label={t('dialog.date')}>
          <DateInput
            value={date}
            max={dayKey(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label={t('dialog.note')}>
          <Input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('dialog.notePlaceholder')}
          />
        </Field>
      </form>
    </Modal>
  );
}

/** Field passes `id` to its child; the picker accepts it. */
function TaskPickerField(props: {
  value: PickedTask | null;
  onChange: (t: PickedTask | null) => void;
  id?: string;
}) {
  return <TaskPicker {...props} />;
}

function hm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}
