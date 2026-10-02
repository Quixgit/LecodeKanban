import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isKey, shift, startOfWeek, todayKey, visibleDays } from './dates';

describe('calendar dates', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('adds months without overflowing short months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01'); // anchors on the 1st
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('starts weeks on Monday', () => {
    expect(startOfWeek('2026-10-02')).toBe('2026-09-28'); // Friday
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28'); // Sunday
  });

  it('builds a 6x7 month grid that covers the whole month', () => {
    const days = visibleDays('2026-10-15', 'month');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-09-28');
    expect(days).toContain('2026-10-31');
    expect(visibleDays('2026-10-15', 'week')).toHaveLength(7);
    expect(visibleDays('2026-10-15', 'day')).toEqual(['2026-10-15']);
  });

  it('shifts by the visible unit', () => {
    expect(shift('2026-10-15', 'month', 1)).toBe('2026-11-01');
    expect(shift('2026-10-15', 'week', -1)).toBe('2026-10-08');
    expect(shift('2026-10-15', 'day', 1)).toBe('2026-10-16');
  });

  it('validates keys and formats today locally', () => {
    expect(isKey('2026-02-30')).toBe(false);
    expect(isKey('2026-02-28')).toBe(true);
    expect(isKey(null)).toBe(false);
    expect(todayKey(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
  });
});
