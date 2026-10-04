import { Clock, Mail, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Select, SettingsCard, TagInput } from '@/shared/ui';
import type { WorkspaceSettings } from '../api/settingsApi';
import { useSaver } from '../hooks/useSaver';
import { SettingRow } from './SettingRow';
import { SettingsPage } from './SettingsPage';

const DAYS = [1, 3, 7, 14, 30];

/** Who may invite people, for how long an invitation lasts, and which email domains are allowed. */
export function AccessPage() {
  const { t } = useTranslation('settings');
  return (
    <SettingsPage title={t('sections.access.title')} description={t('sections.access.description')}>
      {({ workspaceId, settings, canEdit }) => (
        <AccessBody workspaceId={workspaceId} settings={settings} canEdit={canEdit} />
      )}
    </SettingsPage>
  );
}

function AccessBody({
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
      <SettingsCard title={t('access.cardTitle')} description={t('access.cardDescription')}>
        <SettingRow
          icon={<UserPlus />}
          title={t('access.inviteBy.title')}
          description={t('access.inviteBy.description')}
        >
          <Select
            label={t('access.inviteBy.title')}
            disabled={!canEdit}
            value={settings.inviteBy}
            onValueChange={(v) => save({ inviteBy: v as 'admins' | 'members' })}
            options={[
              { value: 'admins', label: t('who.admins') },
              { value: 'members', label: t('who.members') },
            ]}
          />
        </SettingRow>
        <SettingRow
          icon={<ShieldCheck />}
          title={t('access.defaultRole.title')}
          description={t('access.defaultRole.description')}
        >
          <Select
            label={t('access.defaultRole.title')}
            disabled={!canEdit}
            value={settings.defaultInviteRole}
            onValueChange={(v) => save({ defaultInviteRole: v as 'admin' | 'member' | 'viewer' })}
            options={(['admin', 'member', 'viewer'] as const).map((r) => ({
              value: r,
              label: t(`roles.${r}`),
            }))}
          />
        </SettingRow>
        <SettingRow
          icon={<Clock />}
          title={t('access.days.title')}
          description={t('access.days.description')}
        >
          <Select
            label={t('access.days.title')}
            disabled={!canEdit}
            value={String(settings.inviteDays)}
            onValueChange={(v) => save({ inviteDays: Number(v) })}
            options={DAYS.map((d) => ({
              value: String(d),
              label: t('access.days.option', { count: d }),
            }))}
          />
        </SettingRow>
        <SettingRow
          stack
          icon={<Mail />}
          title={t('access.domains.title')}
          description={t('access.domains.description')}
        >
          <TagInput
            aria-label={t('access.domains.title')}
            value={settings.allowedDomains}
            onChange={(next) => canEdit && save({ allowedDomains: next })}
            max={20}
            maxLength={60}
            placeholder={canEdit ? t('access.domains.placeholder') : t('access.domains.any')}
            removeLabel={(d) => t('access.domains.remove', { name: d })}
            fullPlaceholder={t('access.domains.full')}
          />
        </SettingRow>
      </SettingsCard>
      <SettingsCard title={t('access.peopleTitle')} description={t('access.peopleDescription')}>
        <SettingRow
          icon={<UsersRound />}
          title={t('sections.members.title')}
          description={t('sections.members.description')}
        >
          <Link
            to="/team"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-text outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:shadow-focus"
          >
            {t('access.openTeam')}
          </Link>
        </SettingRow>
      </SettingsCard>
    </>
  );
}
