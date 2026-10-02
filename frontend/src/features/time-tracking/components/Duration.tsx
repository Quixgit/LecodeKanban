import { useTranslation } from 'react-i18next';
import { splitDuration } from '../model/duration';

/** "1h 05m" / "12m" / "40s" — localised units. */
export function Duration({ seconds }: { seconds: number }) {
  const { t } = useTranslation('time');
  const { h, m, s } = splitDuration(seconds);
  if (h > 0) return <>{t('duration.hm', { h, m: String(m).padStart(2, '0') })}</>;
  if (m > 0) return <>{t('duration.m', { m })}</>;
  return <>{t('duration.s', { s })}</>;
}
