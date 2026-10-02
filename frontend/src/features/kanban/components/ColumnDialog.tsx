import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUSES, type TaskStatus } from '@/features/cards';
import { Button, Field, Input, Modal, Select } from '@/shared/ui';

export interface ColumnDraft {
  name: string;
  status: TaskStatus;
  wipLimit: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; status is fixed for existing columns. */
  initial?: ColumnDraft;
  focus?: 'name' | 'wip';
  busy: boolean;
  error?: string;
  onSubmit: (draft: ColumnDraft) => void;
}

/** Create a custom column, or rename / limit an existing one. */
export function ColumnDialog({
  open,
  onOpenChange,
  initial,
  focus = 'name',
  busy,
  error,
  onSubmit,
}: Props) {
  const { t } = useTranslation(['kanban', 'common']);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TaskStatus>('in_progress');
  const [wip, setWip] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setStatus(initial?.status ?? 'in_progress');
    setWip(initial?.wipLimit ? String(initial.wipLimit) : '');
  }, [open, initial]);

  const wipNumber = wip.trim() === '' ? null : Number(wip);
  const wipInvalid =
    wipNumber !== null && (!Number.isInteger(wipNumber) || wipNumber < 1 || wipNumber > 999);
  const nameInvalid = name.trim().length === 0 || name.trim().length > 60;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (wipInvalid || nameInvalid) return;
    onSubmit({ name: name.trim(), status, wipLimit: wipNumber });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={initial ? t('column.editTitle') : t('column.addTitle')}
      description={initial ? undefined : t('column.addHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="column-form"
            loading={busy}
            disabled={wipInvalid || nameInvalid}
          >
            {initial ? t('common:actions.save') : t('column.add')}
          </Button>
        </>
      }
    >
      <form id="column-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('column.name')} error={error}>
          <Input
            autoFocus={focus === 'name'}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {!initial && (
          <Field label={t('column.status')} hint={t('column.statusHint')}>
            <Select
              className="w-full justify-between"
              label={t('column.status')}
              value={status}
              onValueChange={(v) => setStatus(v as TaskStatus)}
              options={STATUSES.map((s) => ({ value: s, label: t(`common:status.${s}`) }))}
            />
          </Field>
        )}
        <Field
          label={t('column.wip')}

          hint={t('column.wipFieldHint')}
          error={wipInvalid ? t('column.wipInvalid') : undefined}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            autoFocus={focus === 'wip'}
            placeholder={t('column.noLimit')}
            value={wip}
            invalid={wipInvalid}
            onChange={(e) => setWip(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
