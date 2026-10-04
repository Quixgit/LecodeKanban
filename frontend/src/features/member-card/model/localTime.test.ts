import { describe, expect, it } from 'vitest';
import { isWorkingNow, localTimeIn } from './localTime';

const noon = new Date('2026-10-04T12:00:00Z');

describe('localTimeIn', () => {
  it('shows the local time and the distance from the reference zone', () => {
    const r = localTimeIn('Asia/Tokyo', 'en-GB', new Date(noon), 'UTC');
    expect(r).toEqual({ time: '21:00', offsetHours: 9 });
    expect(localTimeIn('America/New_York', 'en-GB', new Date(noon), 'UTC')?.offsetHours).toBe(-4);
  });
  it('is null without a usable zone', () => {
    expect(localTimeIn('', 'en', noon, 'UTC')).toBeNull();
    expect(localTimeIn('Mars/Olympus', 'en', noon, 'UTC')).toBeNull();
  });
});

describe('isWorkingNow', () => {
  it('compares the clock of the person against their hours', () => {
    expect(isWorkingNow('09:00', '17:00', 'UTC', noon)).toBe(true);
    expect(isWorkingNow('13:00', '17:00', 'UTC', noon)).toBe(false);
    expect(isWorkingNow('09:00', '17:00', 'Asia/Tokyo', noon)).toBe(false);
    expect(isWorkingNow('', '', 'UTC', noon)).toBe(false);
  });
});
