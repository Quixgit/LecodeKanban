import type { TFunction } from 'i18next';
import { splitDuration } from './duration';

/** "1h 05m" / "12m" / "40s" with the language's units, as a string. */
export function formatDuration(t: TFunction, seconds: number): string {
  const { h, m, s } = splitDuration(seconds);
  if (h > 0) return t('time:duration.hm', { h, m: String(m).padStart(2, '0') });
  if (m > 0) return t('time:duration.m', { m });
  return t('time:duration.s', { s });
}
