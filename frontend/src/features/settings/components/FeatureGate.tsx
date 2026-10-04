import { ShieldOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@/shared/ui';
import { useFeatureEnabled, type FeatureKey } from '../hooks/useSettings';

/** Shows a page only while an administrator has that part of the platform switched on. */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { t } = useTranslation('settings');
  const on = useFeatureEnabled(feature);
  if (on) return <>{children}</>;
  return (
    <EmptyState
      icon={<ShieldOff />}
      title={t('gate.title')}
      description={t('gate.description', { feature: t(`features.${feature}.title`) })}
      action={
        <Button asChild variant="secondary">
          <Link to="/">{t('gate.back')}</Link>
        </Button>
      }
    />
  );
}
