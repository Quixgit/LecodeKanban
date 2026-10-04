import { AtSign, CalendarClock, CalendarDays, FolderPlus, Flag, Hash } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select, SettingsCard, Switch } from '@/shared/ui';
import type { WorkspaceSettings } from '../api/settingsApi';
import { useSaver } from '../hooks/useSaver';
import { SettingRow } from './SettingRow';
import { SettingsPage } from './SettingsPage';

/** Who may create projects and channels, and the defaults for new tasks and the calendar. */
export function RulesPage() {
  const { t } = useTranslation('settings');
  return (
    <SettingsPage title={t('sections.rules.title')} description={t('sections.rules.description')}>
      {({ workspaceId, settings, canEdit }) => (
        <RulesBody workspaceId={workspaceId} settings={settings} canEdit={canEdit} />
      )}
    </SettingsPage>
  );
}

function RulesBody({
  workspaceId,
  settings,
  canEdit,
}: {
  workspaceId: string;
  settings: WorkspaceSettings;
  canEdit: boolean;
}) {
  const { t } = useTranslation('settings');
  const { save } = useSaver(workspaceId);
  const who = [
    { value: 'admins', label: t('who.admins') },
    { value: 'members', label: t('who.members') },
  ];
  return (
    <>
      <SettingsCard title={t('rules.projectsTitle')} description={t('rules.projectsDescription')}>
        <SettingRow
          icon={<FolderPlus />}
          title={t('rules.projectCreateBy.title')}
          description={t('rules.projectCreateBy.description')}
        >
          <Select
            label={t('rules.projectCreateBy.title')}
            disabled={!canEdit}
            value={settings.projectCreateBy}
            onValueChange={(v) => save({ projectCreateBy: v as 'admins' | 'members' })}
            options={who}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t('rules.tasksTitle')} description={t('rules.tasksDescription')}>
        <SettingRow
          icon={<Flag />}
          title={t('rules.priority.title')}
          description={t('rules.priority.description')}
        >
          <Select
            label={t('rules.priority.title')}
            disabled={!canEdit}
            value={settings.defaultPriority}
            onValueChange={(v) => save({ defaultPriority: v as 'low' | 'medium' | 'high' })}
            options={(['low', 'medium', 'high'] as const).map((p) => ({
              value: p,
              label: t(`priority.${p}`),
            }))}
          />
        </SettingRow>
        <SettingRow
          icon={<CalendarClock />}
          title={t('rules.dueDate.title')}
          description={t('rules.dueDate.description')}
        >
          <Switch
            checked={settings.requireDueDate}
            disabled={!canEdit}
            aria-label={t('rules.dueDate.title')}
            onCheckedChange={(on) => save({ requireDueDate: on })}
          />
        </SettingRow>
        <SettingRow
          icon={<CalendarDays />}
          title={t('rules.weekStart.title')}
          description={t('rules.weekStart.description')}
        >
          <Select
            label={t('rules.weekStart.title')}
            disabled={!canEdit}
            value={String(settings.weekStart)}
            onValueChange={(v) => save({ weekStart: Number(v) })}
            options={[
              { value: '1', label: t('rules.weekStart.monday') },
              { value: '0', label: t('rules.weekStart.sunday') },
            ]}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={t('rules.chatTitle')} description={t('rules.chatDescription')}>
        <SettingRow
          icon={<Hash />}
          title={t('rules.channelCreateBy.title')}
          description={t('rules.channelCreateBy.description')}
        >
          <Select
            label={t('rules.channelCreateBy.title')}
            disabled={!canEdit}
            value={settings.channelCreateBy}
            onValueChange={(v) => save({ channelCreateBy: v as 'admins' | 'members' })}
            options={who}
          />
        </SettingRow>
        <SettingRow
          icon={<AtSign />}
          title={t('rules.broadcast.title')}
          description={t('rules.broadcast.description')}
        >
          <Select
            label={t('rules.broadcast.title')}
            disabled={!canEdit}
            value={settings.broadcastBy}
            onValueChange={(v) => save({ broadcastBy: v as 'everyone' | 'admins' })}
            options={[
              { value: 'everyone', label: t('who.everyone') },
              { value: 'admins', label: t('who.admins') },
            ]}
          />
        </SettingRow>
      </SettingsCard>
    </>
  );
}
