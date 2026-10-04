import { Globe, Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useChangeLanguage } from '@/features/auth';
import { SoundSettings } from '@/features/notification-sounds';
import { useLanguage } from '@/shared/i18n';
import { SegmentedControl } from '@/shared/ui';
import { useTheme, type ThemePreference } from '@/shared/theme';
import { SettingsCard } from './SettingsLayout';

/** Language, appearance and notification sounds: stored per person, applied everywhere at once. */
export function PreferencesPage() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const changeLanguage = useChangeLanguage();
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('language.title')} description={t('language.description')}>
        <div className="flex flex-wrap items-center gap-4">
          <Globe className="size-5 text-text-muted" aria-hidden />
          <SegmentedControl
            label={t('language.title')}
            value={language}
            onChange={changeLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'uk', label: 'Українська' },
            ]}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={t('theme.title')} description={t('theme.description')}>
        <SegmentedControl<ThemePreference>
          label={t('theme.title')}
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'light', label: t('theme.light'), icon: <Sun className="size-4" /> },
            { value: 'dark', label: t('theme.dark'), icon: <Moon className="size-4" /> },
            { value: 'system', label: t('theme.system'), icon: <Monitor className="size-4" /> },
          ]}
        />
      </SettingsCard>

      <SettingsCard title={t('sounds.title')} description={t('sounds.description')}>
        <div className="-mx-4 -my-5 [&>div]:border-t-0">
          <SoundSettings />
        </div>
      </SettingsCard>
    </div>
  );
}
