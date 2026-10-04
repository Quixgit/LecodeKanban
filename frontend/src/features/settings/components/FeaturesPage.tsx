import { BookOpen, CalendarDays, MessagesSquare, Plug, Timer, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/shared/ui';
import type { WorkspaceFeatures } from '../api/settingsApi';
import { useSaver } from '../hooks/useSaver';
import { SettingRow } from './SettingRow';
import { SettingsPage } from './SettingsPage';
import { SettingsCard } from '@/shared/ui';

const FEATURES: { key: keyof WorkspaceFeatures; icon: LucideIcon }[] = [
  { key: 'chat', icon: MessagesSquare },
  { key: 'docs', icon: BookOpen },
  { key: 'calendar', icon: CalendarDays },
  { key: 'time', icon: Timer },
  { key: 'integrations', icon: Plug },
];

/** Switch parts of the platform on or off for everyone in the workspace. */
export function FeaturesPage() {
  const { t } = useTranslation('settings');
  return (
    <SettingsPage
      title={t('sections.features.title')}
      description={t('sections.features.description')}
    >
      {({ workspaceId, settings, canEdit }) => (
        <FeaturesBody workspaceId={workspaceId} features={settings.features} canEdit={canEdit} />
      )}
    </SettingsPage>
  );
}

function FeaturesBody({
  workspaceId,
  features,
  canEdit,
}: {
  workspaceId: string;
  features: WorkspaceFeatures;
  canEdit: boolean;
}) {
  const { t } = useTranslation('settings');
  const { save } = useSaver(workspaceId);
  return (
    <SettingsCard title={t('features.cardTitle')} description={t('features.cardDescription')}>
      {FEATURES.map(({ key, icon: Icon }) => (
        <SettingRow
          key={key}
          icon={<Icon />}
          title={t(`features.${key}.title`)}
          description={t(`features.${key}.description`)}
        >
          <Switch
            checked={features[key]}
            disabled={!canEdit}
            aria-label={t(`features.${key}.title`)}
            onCheckedChange={(on) => save({ features: { ...features, [key]: on } })}
          />
        </SettingRow>
      ))}
    </SettingsCard>
  );
}
