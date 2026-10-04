import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { Skeleton } from '@/shared/ui';
import type { WorkspaceSettings } from '../api/settingsApi';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { SectionHeader } from './SectionHeader';

export interface SettingsContext {
  workspaceId: string;
  settings: WorkspaceSettings;
  canEdit: boolean;
}

/**
 * The frame of a settings page: header, loading state, and a notice for people who may look but not
 * change. `children` gets the workspace, its settings and whether the person can edit.
 */
export function SettingsPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: (ctx: SettingsContext) => ReactNode;
}) {
  const { t } = useTranslation('settings');
  const { workspace } = useCurrentWorkspace();
  const settings = useWorkspaceSettings(workspace?.id);
  const canEdit = can(workspace, 'workspace.update');
  return (
    <div>
      <SectionHeader title={title} description={description} action={action} />
      {!workspace || !settings.data ? (
        <div className="space-y-4" aria-busy>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {!canEdit && (
            <p className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary">
              <ShieldAlert className="size-4 shrink-0 text-progress-ink" aria-hidden />
              {t('readOnly')}
            </p>
          )}
          {children({ workspaceId: workspace.id, settings: settings.data, canEdit })}
        </div>
      )}
    </div>
  );
}
