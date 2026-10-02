/**
 * Calendar dates are plain "YYYY-MM-DD" keys (the API's `dueDate` format). All arithmetic is done in
 * UTC so daylight-saving shifts and the viewer's time zone can never move a card to another day.
 */

export type CalendarMode = 'month' | 'week' | 'day';
export const MODES: CalendarMode[] = ['month', 'week', 'day'];

const DAY_MS = 86_400_000;

export const parseKey = (key: string): Date => new Date(`${key}T00:00:00Z`);
export const toKey = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (key: string, n: number): string =>
  toKey(new Date(parseKey(key).getTime() + n * DAY_MS));
export const isKey = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && toKey(parseKey(v)) === v;

/** Today in the viewer's local calendar. */
export function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Monday of the week containing `key` (weeks start on Monday in both supported locales). */
export function startOfWeek(key: string): string {
  const dow = (parseKey(key).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -dow);
}

export const startOfMonth = (key: string): string => `${key.slice(0, 7)}-01`;

export function addMonths(key: string, n: number): string {
  const d = parseKey(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toKey(d);
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** The days shown for an anchor date: a 6-week grid for the month, 7 days for the week, 1 for the day. */
export function visibleDays(anchor: string, mode: CalendarMode): string[] {
  if (mode === 'day') return [anchor];
  const first = mode === 'week' ? startOfWeek(anchor) : startOfWeek(startOfMonth(anchor));
  const count = mode === 'week' ? 7 : 42;
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

/** Previous / next page of the calendar. */
export function shift(anchor: string, mode: CalendarMode, dir: -1 | 1): string {
  if (mode === 'month') return addMonths(anchor, dir);
  return addDays(anchor, dir * (mode === 'week' ? 7 : 1));
}
