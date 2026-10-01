import { zodResolver } from '@hookform/resolvers/zod';
import { Archive } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { cn } from '@/shared/lib/cn';
import { fieldMessage } from '@/shared/lib/formMessage';
import { applyServerFieldErrors } from '@/shared/lib/serverErrors';
import {
  Button,
  ConfirmDialog,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
  toneClasses,
} from '@/shared/ui';
import type { Member } from '@/shared/api';
import type { Project, ProjectIcon, Tone } from '../api/projectsApi';
import { useProjectMutations } from '../hooks/useProjects';
import { projectIcons } from './icons';

const ICONS = Object.keys(projectIcons) as ProjectIcon[];
const TONES: Tone[] = ['teal', 'amber', 'purple', 'red', 'neutral'];
const NONE = '__none__';

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, fieldMessage('validation.required'))
      .max(120, fieldMessage('validation.max_length', { max: 120 })),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (v) => v === '' || /^[A-Z][A-Z0-9]{1,5}$/.test(v),
        fieldMessage('validation.project_key'),
      ),
    description: z.string().max(5000, fieldMessage('validation.max_length', { max: 5000 })),
    status: z.enum(['pending', 'in_progress', 'completed']),
    picId: z.string(),
    team: z
      .string()
      .trim()
      .max(60, fieldMessage('validation.max_length', { max: 60 })),
    startDate: z.string(),
    deadline: z.string(),
    icon: z.enum(ICONS as [ProjectIcon, ...ProjectIcon[]]),
    tone: z.enum(['teal', 'amber', 'purple', 'red', 'neutral']),
  })
  .refine((v) => !v.startDate || !v.deadline || v.deadline >= v.startDate, {
    path: ['deadline'],
    message: fieldMessage('validation.date_order'),
  });
type Values = z.infer<typeof schema>;

const FIELDS = ['name', 'key', 'description', 'picId', 'team', 'startDate', 'deadline'] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  members: Member[];
  teams: string[];
  project?: Project | null;
  canArchive: boolean;
}

function defaults(p?: Project | null): Values {
  return {
    name: p?.name ?? '',
    key: p?.key ?? '',
    description: p?.description ?? '',
    status: p?.status ?? 'pending',
    picId: p?.pic?.id ?? NONE,
    team: p?.team ?? '',
    startDate: p?.startDate ?? '',
    deadline: p?.deadline ?? '',
    icon: p?.icon ?? 'folder',
    tone: p?.tone ?? 'teal',
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  teams,
  project,
  canArchive,
}: Props) {
  const { t } = useTranslation(['projects', 'common']);
  const fe = useFieldError();
  const errorText = useErrorText();
  const { create, update, archive } = useProjectMutations(workspaceId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const editing = !!project;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: defaults(project),
    mode: 'onTouched',
  });
  const mutation = editing ? update : create;

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      create.reset();
      update.reset();
    }
  };

  const onSubmit = form.handleSubmit((v) => {
    const pic = v.picId === NONE ? null : v.picId;
    const onError = (err: unknown) => applyServerFieldErrors(err, form.setError, FIELDS);
    if (project) {
      update.mutate(
        {
          id: project.id,
          patch: {
            name: v.name,
            description: v.description,
            status: v.status,
            picId: pic,
            team: v.team || null,
            startDate: v.startDate || null,
            deadline: v.deadline || null,
            icon: v.icon,
            tone: v.tone,
          },
        },
        {
          onSuccess: () => {
            toast.success(t('toast.updated'));
            close(false);
          },
          onError,
        },
      );
      return;
    }
    create.mutate(
      {
        name: v.name,
        key: v.key || undefined,
        description: v.description || undefined,
        status: v.status,
        picId: pic ?? undefined,
        team: v.team || undefined,
        startDate: v.startDate || undefined,
        deadline: v.deadline || undefined,
        icon: v.icon,
        tone: v.tone,
      },
      {
        onSuccess: (p) => {
          toast.success(t('toast.created', { name: p.name }));
          close(false);
        },
        onError,
      },
    );
  });

  const errors = form.formState.errors;
  const generalError =
    mutation.error && !Object.keys(errors).length ? errorText(mutation.error) : null;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={close}
        size="lg"
        title={editing ? t('form.editTitle') : t('form.createTitle')}
        description={t('form.description')}
        footer={
          <div className="flex w-full items-center gap-2">
            {editing && canArchive && (
              <Button
                variant="ghost"
                className="mr-auto text-danger-ink"
                onClick={() => setConfirmArchive(true)}
              >
                <Archive />
                {t('card.archive')}
              </Button>
            )}
            <Button
              variant="secondary"
              className={cn(!(editing && canArchive) && 'ml-auto')}
              onClick={() => close(false)}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" form="project-form" loading={mutation.isPending}>
              {editing ? t('form.save') : t('form.create')}
            </Button>
          </div>
        }
      >
        <form
          id="project-form"
          onSubmit={onSubmit}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <FormAlert>{generalError}</FormAlert>
          </div>
          <Field
            label={t('form.name')}
            error={fe(errors.name?.message)}
            className={editing ? 'sm:col-span-2' : undefined}
          >
            <Input autoFocus placeholder={t('form.namePlaceholder')} {...form.register('name')} />
          </Field>
          {!editing && (
            <Field label={t('form.key')} hint={t('form.keyHint')} error={fe(errors.key?.message)}>
              <Input
                placeholder="MOB"
                maxLength={6}
                className="font-mono uppercase"
                {...form.register('key')}
              />
            </Field>
          )}
          <Field
            label={t('form.about')}
            error={fe(errors.description?.message)}
            className="sm:col-span-2"
          >
            <Textarea rows={3} {...form.register('description')} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('form.status')}</span>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select
                  label={t('form.status')}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="w-full justify-between"
                  options={(['pending', 'in_progress', 'completed'] as const).map((s) => ({
                    value: s,
                    label: t(`common:projectStatus.${s}`),
                  }))}
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('form.pic')}</span>
            <Controller
              control={form.control}
              name="picId"
              render={({ field }) => (
                <Select
                  label={t('form.pic')}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="w-full justify-between"
                  options={[
                    { value: NONE, label: t('form.none') },
                    ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
                  ]}
                />
              )}
            />
            {errors.picId && <p className="text-xs text-danger-ink">{fe(errors.picId.message)}</p>}
          </div>
          <Field label={t('form.team')} error={fe(errors.team?.message)}>
            <Input
              list="project-teams"
              placeholder={t('form.teamPlaceholder')}
              {...form.register('team')}
            />
          </Field>
          <datalist id="project-teams">
            {teams.map((team) => (
              <option key={team} value={team} />
            ))}
          </datalist>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('form.startDate')} error={fe(errors.startDate?.message)}>
              <DateInput {...form.register('startDate')} />
            </Field>
            <Field label={t('form.deadline')} error={fe(errors.deadline?.message)}>
              <DateInput {...form.register('deadline')} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-text">{t('form.icon')}</legend>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => (
                <div role="radiogroup" aria-label={t('form.icon')} className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => {
                    const Icon = projectIcons[icon];
                    const active = field.value === icon;
                    return (
                      <button
                        key={icon}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={icon}
                        onClick={() => field.onChange(icon)}
                        className={cn(
                          'flex size-10 items-center justify-center rounded-lg border transition-colors duration-micro',
                          active
                            ? 'border-primary bg-primary-subtle text-primary-ink'
                            : 'border-border text-text-muted hover:text-text',
                        )}
                      >
                        <Icon className="size-[18px] stroke-[1.75]" />
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium text-text">{t('form.tone')}</legend>
            <Controller
              control={form.control}
              name="tone"
              render={({ field }) => (
                <div role="radiogroup" aria-label={t('form.tone')} className="flex gap-2.5">
                  {TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      role="radio"
                      aria-checked={field.value === tone}
                      aria-label={t(`tones.${tone}`)}
                      onClick={() => field.onChange(tone)}
                      className={cn(
                        'size-8 rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-micro',
                        toneClasses[tone].fill,
                        field.value === tone && 'ring-2 ring-primary',
                      )}
                    />
                  ))}
                </div>
              )}
            />
          </fieldset>
        </form>
      </Modal>
      {project && (
        <ConfirmDialog
          open={confirmArchive}
          onOpenChange={setConfirmArchive}
          title={t('confirmArchive.title', { name: project.name })}
          description={t('confirmArchive.body')}
          confirmLabel={t('confirmArchive.confirm')}
          loading={archive.isPending}
          onConfirm={() =>
            archive.mutate(project.id, {
              onSuccess: () => {
                toast.info(t('toast.archived'));
                setConfirmArchive(false);
                close(false);
              },
              onError: (e) => toast.error(errorText(e)),
            })
          }
        />
      )}
    </>
  );
}
