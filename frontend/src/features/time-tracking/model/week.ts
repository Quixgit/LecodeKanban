import type { TimesheetEntry } from '../api/timeApi';

/** Local calendar helpers for the timesheet. Weeks start on Monday (the platform's calendar does too). */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(startOfDay(d), -day);
}

/** The seven days of the week that starts at `start`. */
export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** YYYY-MM-DD in local time, the key a day is known by. */
export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** When an entry for a day starts if the person gave no time: 09:00 local, or now if that is still to come. */
export function defaultStart(day: Date, now = new Date()): Date {
  const nine = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0);
  return sameDay(day, now) && nine > now ? new Date(now.getTime()) : nine;
}

export interface GridRow {
  card: TimesheetEntry['card'];
  /** Seconds per day of the week, Monday first. */
  cells: number[];
  total: number;
}

export interface Grid {
  rows: GridRow[];
  dayTotals: number[];
  total: number;
}

/** Tasks as rows and days as columns; entries are placed by the local day they started on. */
export function buildGrid(entries: TimesheetEntry[], days: Date[]): Grid {
  const index = new Map(days.map((d, i) => [dayKey(d), i]));
  const rows = new Map<string, GridRow>();
  const dayTotals = days.map(() => 0);
  let total = 0;
  for (const { entry, card } of entries) {
    const i = index.get(dayKey(new Date(entry.startedAt)));
    if (i === undefined) continue;
    let row = rows.get(card.id);
    if (!row) {
      row = { card, cells: days.map(() => 0), total: 0 };
      rows.set(card.id, row);
    }
    row.cells[i]! += entry.seconds;
    row.total += entry.seconds;
    dayTotals[i]! += entry.seconds;
    total += entry.seconds;
  }
  return { rows: [...rows.values()].sort((a, b) => b.total - a.total), dayTotals, total };
}

/**
 * When an entry of `seconds` for `day` starts, so that it never ends in the future (the server refuses that):
 * 09:00 local, but for today no later than "now minus the duration".
 */
export function entryStart(day: Date, seconds: number, now = new Date()): Date {
  const nine = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0);
  if (!sameDay(day, now)) return nine;
  const latest = new Date(now.getTime() - seconds * 1000);
  return nine < latest ? nine : latest;
}

/**
 * Keeps an entry's own start when its longer duration still ends by now; otherwise moves the start earlier,
 * so that making an entry longer never pushes its end into the future.
 */
export function fitStart(start: Date, seconds: number, now = new Date()): Date {
  return start.getTime() + seconds * 1000 <= now.getTime()
    ? start
    : new Date(now.getTime() - seconds * 1000);
}
