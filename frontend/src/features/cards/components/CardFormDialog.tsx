import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { Member } from '@/shared/api';
import { isApiError } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { fieldMessage } from '@/shared/lib/formMessage';
import { applyServerFieldErrors } from '@/shared/lib/serverErrors';
import {
  Button,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
} from '@/shared/ui';
import { cardsApi, type Card, type Priority, type TaskStatus } from '../api/cardsApi';
import { cardKeys, useCardMutations } from '../hooks/useCards';
import { PRIORITIES, STATUSES } from '../model/status';
import { AssigneePicker } from './AssigneePicker';

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, fieldMessage('validation.required'))
    .max(300, fieldMessage('validation.max_length', { max: 300 })),
  description: z.string().max(50000, fieldMessage('validation.max_length', { max: 50000 })),
  projectId: z.string().min(1, fieldMessage('validation.required')),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['high', 'medium', 'low']),
  assigneeIds: z.array(z.string()),
  dueDate: z.string(),
});
type Values = z.infer<typeof schema>;

export interface ProjectOption {
  id: string;
  name: string;
  key: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  projects: ProjectOption[];
  members: Member[];
  card?: Card | null;
  /** Prefills for new cards (e.g. the group's status or the filtered project). */
  initial?: Partial<Pick<Values, 'projectId' | 'status'>>;
}

function defaults(
  card: Card | null | undefined,
  initial: Props['initial'],
  projects: ProjectOption[],
): Values {
  return {
    title: card?.title ?? '',
    description: card?.description ?? '',
    projectId: card?.project.id ?? initial?.projectId ?? projects[0]?.id ?? '',
    status: card?.status ?? initial?.status ?? 'todo',
    priority: card?.priority ?? 'medium',
    assigneeIds: card?.assignees.map((a) => a.id) ?? [],
    dueDate: card?.dueDate ?? '',
  };
}

const FIELDS = ['title', 'description', 'projectId', 'assigneeIds', 'dueDate'] as const;

/** Create / edit a task. Edits send the card version; on conflict the latest version is loaded. */
export function CardFormDialog({
  open,
  onOpenChange,
  workspaceId,
  projects,
  members,
  card,
  initial,
}: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  const fe = useFieldError();
  const errorText = useErrorText();
  const qc = useQueryClient();
  const { create, update, move } = useCardMutations(workspaceId);
  const [latest, setLatest] = useState<Card | null>(null);
  const [conflict, setConflict] = useState(false);
  const current = latest ?? card ?? null;
  const editing = !!current;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: defaults(current, initial, projects),
    mode: 'onTouched',
  });
  const pending = create.isPending || update.isPending || move.isPending;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setLatest(null);
      setConflict(false);
      create.reset();
      update.reset();
    }
  };

  const onError = async (err: unknown) => {
    if (current && isApiError(err, 'cards.version_conflict')) {
      const fresh = await cardsApi.get(current.id);
      qc.setQueryData(cardKeys.one(fresh.id), fresh);
      setLatest(fresh);
      setConflict(true);
      return;
    }
    applyServerFieldErrors(err, form.setError, FIELDS);
  };

  const onSubmit = form.handleSubmit(async (v) => {
    setConflict(false);
    try {
      if (!current) {
        const created = await create.mutateAsync({
          projectId: v.projectId,
          title: v.title,
          description: v.description || undefined,
          status: v.status,
          priority: v.priority,
          assigneeIds: v.assigneeIds,
          dueDate: v.dueDate || undefined,
        });
        toast.success(t('toast.created', { key: created.key }));
        close(false);
        return;
      }
      let saved = await update.mutateAsync({
        id: current.id,
        patch: {
          version: current.version,
          title: v.title,
          description: v.description,
          priority: v.priority,
          assigneeIds: v.assigneeIds,
          dueDate: v.dueDate || null,
        },
      });
      if (v.status !== current.status)
        saved = await move.mutateAsync({ card: saved, move: { status: v.status } });
      toast.success(t('toast.updated', { key: saved.key }));
      close(false);
    } catch (err) {
      await onError(err);
    }
  });

  const errors = form.formState.errors;
  const err = create.error ?? update.error ?? move.error;
  const general = conflict
    ? t('form.conflict')
    : err && !isApiError(err, 'cards.version_conflict') && !Object.keys(errors).length
      ? errorText(err)
      : null;

  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="lg"
      title={editing ? t('form.editTitle', { key: current.key }) : t('form.createTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" form="card-form" loading={pending}>
            {editing ? t('form.save') : t('form.create')}
          </Button>
        </>
      }
    >
      <form id="card-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormAlert tone={conflict ? 'success' : 'error'}>{general}</FormAlert>
        </div>
        <Field label={t('form.title')} error={fe(errors.title?.message)} className="sm:col-span-2">
          <Input autoFocus placeholder={t('form.titlePlaceholder')} {...form.register('title')} />
        </Field>
        <Field
          label={t('form.description')}
          error={fe(errors.description?.message)}
          className="sm:col-span-2"
        >
          <Textarea
            rows={4}
            placeholder={t('form.descriptionPlaceholder')}
            {...form.register('description')}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">{t('form.project')}</span>
          <Controller
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <Select
                label={t('form.project')}
                value={field.value}
                onValueChange={field.onChange}
                disabled={editing}
                className="w-full justify-between"
                options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
              />
            )}
          />
          {errors.projectId && (
            <p className="text-xs text-danger-ink">{fe(errors.projectId.message)}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">{t('form.status')}</span>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select
                label={t('form.status')}
                value={field.value}
                onValueChange={(v) => field.onChange(v as TaskStatus)}
                className="w-full justify-between"
                options={STATUSES.map((s) => ({ value: s, label: t(`common:status.${s}`) }))}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">{t('form.priority')}</span>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select
                label={t('form.priority')}
                value={field.value}
                onValueChange={(v) => field.onChange(v as Priority)}
                className="w-full justify-between"
                options={PRIORITIES.map((p) => ({ value: p, label: t(`common:priority.${p}`) }))}
              />
            )}
          />
        </div>
        <Field label={t('form.dueDate')} error={fe(errors.dueDate?.message)}>
          <DateInput {...form.register('dueDate')} />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="card-assignees" className="text-sm font-medium text-text">
            {t('form.assignees')}
          </label>
          <Controller
            control={form.control}
            name="assigneeIds"
            render={({ field }) => (
              <AssigneePicker
                id="card-assignees"
                label={t('form.assignees')}
                members={members}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {errors.assigneeIds && (
            <p className="text-xs text-danger-ink">{fe(errors.assigneeIds.message)}</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
