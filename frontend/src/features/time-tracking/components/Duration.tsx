import { useTranslation } from 'react-i18next';
import { formatDuration } from '../model/formatDuration';

/** "1h 05m" / "12m" / "40s" — localised units. */
export function Duration({ seconds }: { seconds: number }) {
  const { t } = useTranslation('time');
  return <>{formatDuration(t, seconds)}</>;
}
