import {
  CalendarClock,
  CalendarDays,
  Eye,
  Layers,
  Clock,
  FileUp,
  Flag,
  MessageSquare,
  PencilLine,
  UserCheck,
} from 'lucide-react';
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
  return (
    <>
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
          icon={<UserCheck />}
          title={t('rules.assignee.title')}
          description={t('rules.assignee.description')}
        >
          <Switch
            checked={settings.requireAssignee}
            disabled={!canEdit}
            aria-label={t('rules.assignee.title')}
            onCheckedChange={(on) => save({ requireAssignee: on })}
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
          icon={<MessageSquare />}
          title={t('rules.direct.title')}
          description={t('rules.direct.description')}
        >
          <Switch
            checked={settings.chatAllowDirect}
            disabled={!canEdit}
            aria-label={t('rules.direct.title')}
            onCheckedChange={(on) => save({ chatAllowDirect: on })}
          />
        </SettingRow>
        <SettingRow
          icon={<FileUp />}
          title={t('rules.files.title')}
          description={t('rules.files.description')}
        >
          <Switch
            checked={settings.chatAllowFiles}
            disabled={!canEdit}
            aria-label={t('rules.files.title')}
            onCheckedChange={(on) => save({ chatAllowFiles: on })}
          />
        </SettingRow>
        <SettingRow
          icon={<PencilLine />}
          title={t('rules.editWindow.title')}
          description={t('rules.editWindow.description')}
        >
          <Select
            label={t('rules.editWindow.title')}
            disabled={!canEdit}
            value={String(settings.chatEditMinutes)}
            onValueChange={(v) => save({ chatEditMinutes: Number(v) })}
            options={[0, 5, 15, 60, 1440].map((n) => ({
              value: String(n),
              label: t(n === 0 ? 'rules.editWindow.always' : 'rules.editWindow.minutes', {
                count: n,
              }),
            }))}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title={t('rules.timeTitle')} description={t('rules.timeDescription')}>
        <SettingRow
          icon={<Clock />}
          title={t('rules.manualTime.title')}
          description={t('rules.manualTime.description')}
        >
          <Switch
            checked={settings.timeAllowManual}
            disabled={!canEdit}
            aria-label={t('rules.manualTime.title')}
            onCheckedChange={(on) => save({ timeAllowManual: on })}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title={t('rules.docsTitle')} description={t('rules.docsDescription')}>
        <SettingRow
          icon={<Eye />}
          title={t('rules.docsVisibility.title')}
          description={t('rules.docsVisibility.description')}
        >
          <Select
            label={t('rules.docsVisibility.title')}
            disabled={!canEdit}
            value={settings.docsVisibility}
            onValueChange={(v) => save({ docsVisibility: v as 'private' | 'shared' | 'workspace' })}
            options={(['private', 'shared', 'workspace'] as const).map((v) => ({
              value: v,
              label: t(`rules.docsVisibility.${v}`),
            }))}
          />
        </SettingRow>
        <SettingRow
          icon={<Layers />}
          title={t('rules.docsDepth.title')}
          description={t('rules.docsDepth.description')}
        >
          <Select
            label={t('rules.docsDepth.title')}
            disabled={!canEdit}
            value={String(settings.docsMaxDepth)}
            onValueChange={(v) => save({ docsMaxDepth: Number(v) })}
            options={[3, 4, 6, 8, 12].map((n) => ({
              value: String(n),
              label: t('rules.docsDepth.levels', { count: n }),
            }))}
          />
        </SettingRow>
      </SettingsCard>
    </>
  );
}
