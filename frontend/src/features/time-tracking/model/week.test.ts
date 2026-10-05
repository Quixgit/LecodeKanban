import { describe, expect, it } from 'vitest';
import type { TimesheetEntry } from '../api/timeApi';
import {
  addDays,
  buildGrid,
  dayKey,
  defaultStart,
  entryStart,
  fitStart,
  startOfWeek,
  weekDays,
} from './week';

const entry = (cardId: string, startedAt: Date, seconds: number): TimesheetEntry =>
  ({
    entry: {
      id: `${cardId}-${startedAt.toISOString()}`,
      startedAt: startedAt.toISOString(),
      seconds,
    },
    card: { id: cardId, key: `K-${cardId}`, title: cardId },
  }) as unknown as TimesheetEntry;

describe('timesheet week', () => {
  it('starts on Monday', () => {
    expect(dayKey(startOfWeek(new Date(2026, 9, 14)))).toBe('2026-10-12'); // Wednesday
    expect(dayKey(startOfWeek(new Date(2026, 9, 18)))).toBe('2026-10-12'); // Sunday
    expect(dayKey(startOfWeek(new Date(2026, 9, 12)))).toBe('2026-10-12'); // Monday
  });
  it('crosses month ends', () => {
    const days = weekDays(new Date(2026, 9, 26));
    expect(days.map(dayKey)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
  it('puts entries in their task row and day column, with totals', () => {
    const mon = new Date(2026, 9, 12);
    const days = weekDays(mon);
    const g = buildGrid(
      [
        entry('a', new Date(2026, 9, 12, 9), 3600),
        entry('a', new Date(2026, 9, 12, 14), 1800),
        entry('a', new Date(2026, 9, 14, 10), 600),
        entry('b', new Date(2026, 9, 14, 11), 7200),
        entry('c', addDays(mon, 9), 100), // outside the week
      ],
      days,
    );
    expect(g.rows.map((r) => r.card.id)).toEqual(['b', 'a']); // biggest first
    expect(g.rows[1]!.cells).toEqual([5400, 0, 600, 0, 0, 0, 0]);
    expect(g.dayTotals).toEqual([5400, 0, 7800, 0, 0, 0, 0]);
    expect(g.total).toBe(13200);
  });
  it('defaults an entry to 09:00, or now when today is earlier than that', () => {
    const day = new Date(2026, 9, 14);
    expect(defaultStart(day, new Date(2026, 9, 14, 15, 0)).getHours()).toBe(9);
    const early = new Date(2026, 9, 14, 7, 30);
    expect(defaultStart(day, early).getTime()).toBe(early.getTime());
    expect(defaultStart(new Date(2026, 9, 10), early).getHours()).toBe(9);
  });
  it('never starts an entry so that it ends in the future', () => {
    const now = new Date(2026, 9, 14, 11, 0);
    const today = new Date(2026, 9, 14);
    expect(entryStart(today, 3600, now).getHours()).toBe(9); // 09:00–10:00 is over
    expect(entryStart(today, 4 * 3600, now).getTime()).toBe(now.getTime() - 4 * 3600 * 1000); // 07:00–11:00
    expect(entryStart(new Date(2026, 9, 10), 4 * 3600, now).getHours()).toBe(9); // a past day keeps 09:00
  });
  it('moves a lengthened entry earlier instead of past now', () => {
    const now = new Date(2026, 9, 14, 11, 0);
    const start = new Date(2026, 9, 14, 10, 0);
    expect(fitStart(start, 1800, now).getTime()).toBe(start.getTime()); // ends 10:30
    expect(fitStart(start, 5400, now).getTime()).toBe(new Date(2026, 9, 14, 9, 30).getTime()); // would end 11:30
  });
});
