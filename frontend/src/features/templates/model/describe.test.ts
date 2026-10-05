import { describe, expect, it } from 'vitest';
import { describeSchedule, hourLabel, weekdayNames } from './describe';

describe('schedule sentences', () => {
  const names = weekdayNames('en');

  it('names the weekdays Monday first', () => {
    expect(names).toHaveLength(7);
    expect(names[0]).toMatch(/^Mon/);
    expect(names[6]).toMatch(/^Sun/);
  });

  it('formats the hour with a leading zero', () => {
    expect(hourLabel(9)).toBe('09:00');
    expect(hourLabel(0)).toBe('00:00');
  });

  it('describes each frequency', () => {
    expect(
      describeSchedule({ freq: 'daily', weekdays: [], monthDay: null, hour: 8 }, names),
    ).toEqual({
      key: 'daily',
      values: { time: '08:00' },
    });
    const w = describeSchedule(
      { freq: 'weekly', weekdays: [5, 1], monthDay: null, hour: 9 },
      names,
    );
    expect(w.key).toBe('weekly');
    expect(w.values.days).toMatch(/^Mon.*Fri/);
    expect(
      describeSchedule({ freq: 'monthly', weekdays: [], monthDay: 31, hour: 10 }, names).values,
    ).toEqual({ day: 31, time: '10:00' });
  });
});
