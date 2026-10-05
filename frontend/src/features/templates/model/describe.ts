import type { RecurringTask } from '../api/templatesApi';

/** Short weekday names, Monday first, in the interface language. */
export function weekdayNames(language: string): string[] {
  const fmt = new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' });
  // 5 January 2026 is a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 5 + i))));
}

export const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** The pieces a sentence about a schedule needs: which key to use and its values. */
export function describeSchedule(
  r: Pick<RecurringTask, 'freq' | 'weekdays' | 'monthDay' | 'hour'>,
  names: string[],
): { key: 'daily' | 'weekly' | 'monthly'; values: Record<string, string | number> } {
  const time = hourLabel(r.hour);
  switch (r.freq) {
    case 'weekly':
      return {
        key: 'weekly',
        values: {
          days: [...r.weekdays]
            .sort((a, b) => a - b)
            .map((d) => names[d - 1])
            .join(', '),
          time,
        },
      };
    case 'monthly':
      return { key: 'monthly', values: { day: r.monthDay ?? 1, time } };
    default:
      return { key: 'daily', values: { time } };
  }
}
