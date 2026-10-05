import { Columns2, Rows3, PanelLeft, LayoutPanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDensity, type Density } from '@/shared/lib/density';
import { useShellLayout, type ShellLayout } from '@/shared/lib/shellLayout';
import { SegmentedControl, SettingsCard } from '@/shared/ui';

/** How the interface looks and fits on this browser: density and the shape of the side menu. */
export function InterfaceCard() {
  const { t } = useTranslation('profile');
  const density = useDensity((s) => s.density);
  const setDensity = useDensity((s) => s.setDensity);
  const layout = useShellLayout((s) => s.layout);
  const setLayout = useShellLayout((s) => s.setLayout);
  return (
    <SettingsCard title={t('interface.title')} description={t('interface.description')}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">{t('interface.density.title')}</p>
            <p className="text-sm text-text-muted">{t('interface.density.description')}</p>
          </div>
          <SegmentedControl<Density>
            label={t('interface.density.title')}
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: t('interface.density.comfortable'), icon: <Rows3 /> },
              { value: 'compact', label: t('interface.density.compact'), icon: <Columns2 /> },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">{t('interface.menu.title')}</p>
            <p className="text-sm text-text-muted">{t('interface.menu.description')}</p>
          </div>
          <SegmentedControl<ShellLayout>
            label={t('interface.menu.title')}
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'classic', label: t('interface.menu.classic'), icon: <PanelLeft /> },
              { value: 'rail', label: t('interface.menu.rail'), icon: <LayoutPanelLeft /> },
            ]}
          />
        </div>
      </div>
    </SettingsCard>
  );
}
