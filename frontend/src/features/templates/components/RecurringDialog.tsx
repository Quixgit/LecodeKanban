import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { deviceTimezone } from '@/features/profile';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button, Field, Input, Modal, Select, Switch, toast } from '@/shared/ui';
import type { RecurringTask, TaskTemplate } from '../api/templatesApi';
import { useRecurringMutations } from '../hooks/useTemplates';
import {
  WEEKDAYS,
  draftError,
  draftFrom,
  emptyRecurring,
  toInput,
  toggleWeekday,
  type Freq,
  type RecurringDraft,
} from '../model/schedule';
import { weekdayNames } from '../model/describe';

const FREQS: Freq[] = ['daily', 'weekly', 'monthly'];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Set up (or change) a task that creates itself on a schedule from a template. */
export function RecurringDialog({
  open,
  onOpenChange,
  workspaceId,
  templates,
  recurring,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  templates: TaskTemplate[];
  recurring?: RecurringTask;
}) {
  const { t } = useTranslation('templates');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const projects = useAllProjects(workspaceId).data?.items ?? [];
  const { create, update } = useRecurringMutations(workspaceId);
  const [draft, setDraft] = useState<RecurringDraft>(() => emptyRecurring(deviceTimezone()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(recurring ? draftFrom(recurring) : emptyRecurring(deviceTimezone()));
    setError(null);
  }, [open, recurring]);

  const patch = (p: Partial<RecurringDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setError(null);
  };
  const days = weekdayNames(language);

  const submit = () => {
    const missing = draftError(draft);
    if (missing) return setError(t(`recurring.errors.${missing}`));
    const body = toInput(draft);
    const done = () => {
      toast.success(recurring ? t('recurring.updated') : t('recurring.created'));
      onOpenChange(false);
    };
    const failed = (e: unknown) => setError(errorText(e));
    if (recurring) update.mutate({ id: recurring.id, body }, { onSuccess: done, onError: failed });
    else create.mutate(body, { onSuccess: done, onError: failed });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={recurring ? t('recurring.editTitle') : t('recurring.newTitle')}
      description={t('recurring.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('dialog.cancel')}
          </Button>
          <Button onClick={submit} loading={create.isPending || update.isPending}>
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
        {error && (
          <p role="alert" className="text-sm text-danger-ink">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('recurring.template')}</span>
            <Select
              label={t('recurring.template')}
              value={draft.templateId || undefined}
              onValueChange={(v) => patch({ templateId: v })}
              options={templates.map((x) => ({ value: x.id, label: x.name }))}
              placeholder={t('recurring.templatePlaceholder')}
              className="w-full justify-between"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('recurring.project')}</span>
            <Select
              label={t('recurring.project')}
              value={draft.projectId || undefined}
              onValueChange={(v) => patch({ projectId: v })}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder={t('use.projectPlaceholder')}
              className="w-full justify-between"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">{t('recurring.repeat')}</span>
          <div role="radiogroup" aria-label={t('recurring.repeat')} className="flex gap-1.5">
            {FREQS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={draft.freq === f}
                onClick={() => patch({ freq: f })}
                className={cn(
                  'h-8 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  draft.freq === f
                    ? 'border-primary-border bg-primary-subtle text-primary-ink'
                    : 'border-border text-text-secondary hover:bg-surface-sunken',
                )}
              >
                {t(`recurring.freq.${f}`)}
              </button>
            ))}
          </div>
        </div>

        {draft.freq === 'weekly' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('recurring.on')}</span>
            <div role="group" aria-label={t('recurring.on')} className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={draft.weekdays.includes(d)}
                  onClick={() => patch({ weekdays: toggleWeekday(draft.weekdays, d) })}
                  className={cn(
                    'h-8 min-w-11 rounded-lg border px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    draft.weekdays.includes(d)
                      ? 'border-primary-border bg-primary-subtle text-primary-ink'
                      : 'border-border text-text-secondary hover:bg-surface-sunken',
                  )}
                >
                  {days[d - 1]}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.freq === 'monthly' && (
          <Field label={t('recurring.dayOfMonth')} hint={t('recurring.dayOfMonthHint')}>
            <Input
              type="number"
              min={1}
              max={31}
              value={draft.monthDay}
              onChange={(e) =>
                patch({ monthDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
              }
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('recurring.at')}</span>
            <Select
              label={t('recurring.at')}
              value={String(draft.hour)}
              onValueChange={(v) => patch({ hour: Number(v) })}
              options={HOURS.map((h) => ({
                value: String(h),
                label: `${String(h).padStart(2, '0')}:00`,
              }))}
              className="w-full justify-between"
            />
          </div>
          <Field label={t('recurring.timezone')} hint={t('recurring.timezoneHint')}>
            <Input
              value={draft.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
              autoComplete="off"
            />
          </Field>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2.5">
          <span className="text-sm text-text">{t('recurring.active')}</span>
          <Switch
            checked={draft.active}
            onCheckedChange={(v) => patch({ active: v })}
            aria-label={t('recurring.active')}
          />
        </label>
      </form>
    </Modal>
  );
}
