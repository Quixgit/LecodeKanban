import { describe, expect, it } from 'vitest';
import { daysUntil, isPast, todayISO } from './dates';

const now = new Date('2026-10-01T23:30:00Z');

describe('dates', () => {
  it('uses UTC calendar days', () => {
    expect(todayISO(now)).toBe('2026-10-01');
    expect(isPast('2026-09-30', now)).toBe(true);
    expect(isPast('2026-10-01', now)).toBe(false);
    expect(isPast(null, now)).toBe(false);
    expect(daysUntil('2026-10-08', now)).toBe(7);
    expect(daysUntil('2026-09-28', now)).toBe(-3);
  });
});
