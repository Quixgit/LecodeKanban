import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, DateInput, Field, Input, Modal, Select, toast } from '@/shared/ui';
import type { TaskTemplate } from '../api/templatesApi';
import { useTemplateMutations } from '../hooks/useTemplates';

/** Create a task from a template: in which project, with what title, due when. */
export function UseTemplateDialog({
  template,
  onOpenChange,
  workspaceId,
}: {
  template: TaskTemplate | null;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}) {
  const { t } = useTranslation('templates');
  const errorText = useErrorText();
  const projects = useAllProjects(workspaceId).data?.items ?? [];
  const { use } = useTemplateMutations(workspaceId);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;
    setProjectId('');
    setTitle(template.title);
    setDue('');
    setError(null);
  }, [template]);

  const submit = () => {
    if (!template) return;
    if (!projectId) return setError(t('use.errors.project'));
    use.mutate(
      {
        id: template.id,
        body: {
          projectId,
          title: title.trim() && title.trim() !== template.title ? title.trim() : null,
          dueDate: due || null,
        },
      },
      {
        onSuccess: (card) => {
          toast.success(t('use.created'), card.title);
          onOpenChange(false);
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  return (
    <Modal
      open={!!template}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('use.title', { name: template?.name ?? '' })}
      description={t('use.hint')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('dialog.cancel')}
          </Button>
          <Button onClick={submit} loading={use.isPending}>
            {t('use.create')}
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
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">{t('use.project')}</span>
          <Select
            label={t('use.project')}
            value={projectId || undefined}
            onValueChange={(v) => {
              setProjectId(v);
              setError(null);
            }}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={t('use.projectPlaceholder')}
            className="w-full justify-between"
          />
          {error && (
            <p role="alert" className="text-sm text-danger-ink">
              {error}
            </p>
          )}
        </div>
        <Field label={t('use.taskTitle')}>
          <Input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field
          label={t('use.due')}
          hint={
            template?.dueInDays !== null && template?.dueInDays !== undefined
              ? t('use.dueFromTemplate', { count: template.dueInDays })
              : t('use.dueNone')
          }
        >
          <DateInput value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
