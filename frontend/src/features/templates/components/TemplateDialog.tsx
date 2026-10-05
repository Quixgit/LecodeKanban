import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIORITIES } from '@/features/cards';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Field, Input, Modal, Select, Textarea, toast } from '@/shared/ui';
import type { TaskTemplate } from '../api/templatesApi';
import { useTemplateMutations } from '../hooks/useTemplates';
import {
  emptyTemplate,
  parseDueDays,
  parseLines,
  templateDraft,
  type TemplateDraft,
} from '../model/schedule';

/** Make or edit a template: the starting point of a task, with its checklist and subtasks. */
export function TemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  template?: TaskTemplate;
}) {
  const { t } = useTranslation(['templates', 'common']);
  const errorText = useErrorText();
  const { create, update } = useTemplateMutations(workspaceId);
  const [draft, setDraft] = useState<TemplateDraft>(emptyTemplate);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'title' | 'due' | 'form', string>>>(
    {},
  );

  useEffect(() => {
    if (!open) return;
    setDraft(template ? templateDraft(template) : emptyTemplate);
    setErrors({});
  }, [open, template]);

  const patch = (p: Partial<TemplateDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors({});
  };

  const submit = () => {
    const due = parseDueDays(draft.dueInDays);
    const next: typeof errors = {};
    if (!draft.name.trim()) next.name = t('dialog.errors.name');
    if (!draft.title.trim()) next.title = t('dialog.errors.title');
    if (due === undefined) next.due = t('dialog.errors.due');
    if (Object.keys(next).length > 0) return setErrors(next);
    const body = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      description: draft.description,
      priority: draft.priority,
      checklist: parseLines(draft.checklist),
      subtasks: parseLines(draft.subtasks),
      dueInDays: due ?? null,
      // Labels and people are kept as they are when a template is edited.
      labelIds: template?.labelIds ?? [],
      assigneeIds: template?.assigneeIds ?? [],
    };
    const done = () => {
      toast.success(template ? t('dialog.updated') : t('dialog.created'));
      onOpenChange(false);
    };
    const failed = (e: unknown) => setErrors({ form: errorText(e) });
    if (template) update.mutate({ id: template.id, body }, { onSuccess: done, onError: failed });
    else create.mutate(body, { onSuccess: done, onError: failed });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={template ? t('dialog.editTitle') : t('dialog.newTitle')}
      description={t('dialog.hint')}
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
        noValidate
      >
        {errors.form && (
          <p role="alert" className="text-sm text-danger-ink">
            {errors.form}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dialog.name')} hint={t('dialog.nameHint')} error={errors.name}>
            <Input
              value={draft.name}
              maxLength={80}
              autoFocus
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('dialog.namePlaceholder')}
            />
          </Field>
          <Field label={t('dialog.title')} hint={t('dialog.titleHint')} error={errors.title}>
            <Input
              value={draft.title}
              maxLength={300}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={t('dialog.titlePlaceholder')}
            />
          </Field>
        </div>
        <Field label={t('dialog.description')}>
          <Textarea
            value={draft.description}
            rows={3}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('dialog.checklist')} hint={t('dialog.linesHint')}>
            <Textarea
              value={draft.checklist}
              rows={4}
              onChange={(e) => patch({ checklist: e.target.value })}
              placeholder={t('dialog.checklistPlaceholder')}
            />
          </Field>
          <Field label={t('dialog.subtasks')} hint={t('dialog.linesHint')}>
            <Textarea
              value={draft.subtasks}
              rows={4}
              onChange={(e) => patch({ subtasks: e.target.value })}
              placeholder={t('dialog.subtasksPlaceholder')}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">{t('dialog.priority')}</span>
            <Select
              label={t('dialog.priority')}
              value={draft.priority}
              onValueChange={(v) => patch({ priority: v as TemplateDraft['priority'] })}
              options={PRIORITIES.map((p) => ({ value: p, label: t(`common:priority.${p}`) }))}
            />
          </div>
          <Field label={t('dialog.dueIn')} hint={t('dialog.dueInHint')} error={errors.due}>
            <Input
              inputMode="numeric"
              value={draft.dueInDays}
              onChange={(e) => patch({ dueInDays: e.target.value })}
              placeholder="7"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
