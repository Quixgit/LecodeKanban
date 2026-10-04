import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RolePill, useCurrentWorkspace, useWorkspaceMutations } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Field, Input, Modal, SettingsCard, Skeleton, Textarea, toast } from '@/shared/ui';
import { useSaver } from '../hooks/useSaver';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { SectionHeader } from './SectionHeader';

/** Workspace name, address and the delete button (owners only). */
export function GeneralPage() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return <Skeleton className="h-48" />;
  return <GeneralForm key={workspace.id} workspace={workspace} />;
}

function GeneralForm({
  workspace,
}: {
  workspace: NonNullable<ReturnType<typeof useCurrentWorkspace>['workspace']>;
}) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const m = useWorkspaceMutations(workspace.id);
  const [name, setName] = useState(workspace.name);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState('');
  const settings = useWorkspaceSettings(workspace.id);
  const saver = useSaver(workspace.id);
  const [about, setAbout] = useState<string | null>(null);
  const aboutValue = about ?? settings.data?.description ?? '';
  const canEdit = workspace.role === 'owner' || workspace.role === 'admin';
  const isOwner = workspace.role === 'owner';
  const dirty = name.trim() !== workspace.name && name.trim() !== '';

  const save = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    m.rename.mutate(name.trim(), {
      onSuccess: () => toast.success(t('general.saved')),
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t('sections.general.title')}
        description={t('sections.general.description')}
      />
      <form onSubmit={save} noValidate>
        <SettingsCard
          title={t('general.nameTitle')}
          description={t('general.nameDescription')}
          footer={
            canEdit ? (
              <Button type="submit" loading={m.rename.isPending} disabled={!dirty}>
                {t('general.save')}
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('general.name')} error={error ?? undefined}>
              <Input
                value={name}
                maxLength={80}
                readOnly={!canEdit}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label={t('general.slug')} hint={t('general.slugHint')}>
              <Input value={workspace.slug} readOnly />
            </Field>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-text-muted">
            {t('general.yourRole')} <RolePill role={workspace.role} />
          </p>
        </SettingsCard>
      </form>

      <SettingsCard
        title={t('general.aboutTitle')}
        description={t('general.aboutDescription')}
        footer={
          canEdit ? (
            <Button
              loading={saver.saving}
              disabled={about === null || about === (settings.data?.description ?? '')}
              onClick={() => saver.save({ description: aboutValue }, () => setAbout(null))}
            >
              {t('general.saveAbout')}
            </Button>
          ) : undefined
        }
      >
        <Field label={t('general.description')} hint={`${aboutValue.length} / 300`}>
          <Textarea
            rows={3}
            maxLength={300}
            readOnly={!canEdit}
            value={aboutValue}
            onChange={(e) => setAbout(e.target.value)}
          />
        </Field>
      </SettingsCard>

      <section
        aria-label={t('general.dangerTitle')}
        className="overflow-hidden rounded-2xl border border-danger/40 bg-surface"
      >
        <header className="border-b border-danger/20 bg-danger/5 px-6 py-4">
          <h3 className="text-base font-semibold text-danger-ink">{t('general.dangerTitle')}</h3>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="max-w-md">
            <p className="text-sm font-medium text-text">{t('general.deleteTitle')}</p>
            <p className="text-sm text-text-muted">
              {isOwner ? t('general.deleteBody') : t('general.deleteOwnersOnly')}
            </p>
          </div>
          <Button variant="danger" disabled={!isOwner} onClick={() => setDeleting(true)}>
            <Trash2 />
            {t('general.deleteButton')}
          </Button>
        </div>
      </section>

      <Modal
        open={deleting}
        onOpenChange={(o) => {
          setDeleting(o);
          if (!o) setTyped('');
        }}
        title={t('general.confirmTitle', { name: workspace.name })}
        description={t('general.confirmBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              {t('general.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={m.deleteWorkspace.isPending}
              disabled={typed !== workspace.name}
              onClick={() =>
                m.deleteWorkspace.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('general.deleted'));
                    navigate('/');
                  },
                  onError: (err) => toast.error(errorText(err)),
                })
              }
            >
              {t('general.deleteConfirm')}
            </Button>
          </>
        }
      >
        <Field label={t('general.typeName', { name: workspace.name })}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
      </Modal>
    </div>
  );
}
