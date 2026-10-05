import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, toast } from '@/shared/ui';
import { useTimeMutations } from '../hooks/useTime';
import { parseDuration } from '../model/duration';

const hm = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
};

/** Sets or removes the time a task is expected to take; the card shows logged time against it. */
export function EstimateButton({
  cardId,
  estimate,
  editable,
}: {
  cardId: string;
  estimate: number | null;
  editable: boolean;
}) {
  const { t } = useTranslation('time');
  const errorText = useErrorText();
  const { setEstimate } = useTimeMutations();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  if (!editable) return null;

  const save = (seconds: number | null) =>
    setEstimate.mutate(
      { cardId, seconds },
      {
        onSuccess: () => {
          setOpen(false);
          if (seconds !== null) toast.success(t('estimate.saved'));
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seconds = parseDuration(text);
    if (seconds === null || seconds < 60 || seconds > 3_600_000) return setInvalid(true);
    save(seconds);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setText(estimate ? hm(estimate) : '');
          setInvalid(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary-ink outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Pencil className="size-3" aria-hidden />
          {estimate ? t('estimate.edit') : t('estimate.set')}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="estimate-input" className="text-sm font-medium text-text">
            {t('estimate.title')}
          </label>
          <Input
            id="estimate-input"
            value={text}
            invalid={invalid}
            autoFocus
            autoComplete="off"
            placeholder={t('estimate.placeholder')}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
          />
          {invalid && <p className="text-xs text-danger-ink">{t('estimate.invalid')}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            {estimate ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => save(null)}>
                {t('estimate.clear')}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" loading={setEstimate.isPending}>
              {t('estimate.save')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
