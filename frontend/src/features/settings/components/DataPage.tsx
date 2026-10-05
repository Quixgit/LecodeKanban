import { Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import { EmptyState, Select, SettingsCard, Skeleton } from '@/shared/ui';
import { SectionHeader } from './SectionHeader';
import { SettingRow } from './SettingRow';

/** Take your data with you: the tasks as a spreadsheet, for the whole workspace or one project. */
export function DataPage() {
  const { t } = useTranslation('settings');
  const { workspace } = useCurrentWorkspace();
  const projects = useAllProjects(workspace?.id);
  const [project, setProject] = useState('all');
  if (!workspace) return <Skeleton className="h-40" />;
  const allowed = can(workspace, 'data.export');
  const query = project === 'all' ? '' : `?projectId=${encodeURIComponent(project)}`;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={t('sections.data.title')}
        description={t('sections.data.description')}
      />
      {!allowed ? (
        <EmptyState icon={<FileSpreadsheet />} title={t('data.noAccess')} />
      ) : (
        <SettingsCard title={t('data.tasksTitle')} description={t('data.tasksDescription')}>
          <SettingRow
            icon={<FileSpreadsheet />}
            title={t('data.scope.title')}
            description={t('data.scope.description')}
          >
            <Select
              label={t('data.scope.title')}
              value={project}
              onValueChange={setProject}
              options={[
                { value: 'all', label: t('data.scope.all') },
                ...(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </SettingRow>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={`/api/v1/workspaces/${workspace.id}/export/tasks.csv${query}`}
              download
              className={buttonVariants({ variant: 'primary' })}
            >
              <Download />
              {t('data.download')}
            </a>
            <p className="text-xs text-text-muted">{t('data.hint')}</p>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
