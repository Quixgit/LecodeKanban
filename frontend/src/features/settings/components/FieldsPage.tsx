import { useTranslation } from 'react-i18next';
import { FieldsAdmin } from '@/features/custom-fields';
import { useCurrentWorkspace } from '@/features/workspaces';
import { Skeleton } from '@/shared/ui';
import { SectionHeader } from './SectionHeader';

export function FieldsPage() {
  const { t } = useTranslation('settings');
  const { workspace } = useCurrentWorkspace();
  return (
    <div>
      <SectionHeader
        title={t('sections.fields.title')}
        description={t('sections.fields.description')}
      />
      {workspace ? (
        <FieldsAdmin
          workspaceId={workspace.id}
          canEdit={workspace.role === 'owner' || workspace.role === 'admin'}
        />
      ) : (
        <Skeleton className="h-48" />
      )}
    </div>
  );
}
