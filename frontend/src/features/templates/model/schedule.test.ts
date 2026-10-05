import { describe, expect, it } from 'vitest';
import {
  draftError,
  emptyRecurring,
  parseDueDays,
  parseLines,
  toInput,
  toggleWeekday,
} from './schedule';

describe('recurring drafts', () => {
  it('sends only what belongs to the frequency', () => {
    const base = { ...emptyRecurring('Europe/Kyiv'), templateId: 't', projectId: 'p' };
    expect(toInput({ ...base, freq: 'weekly', weekdays: [5, 1] })).toMatchObject({
      weekdays: [1, 5],
      monthDay: undefined,
    });
    expect(toInput({ ...base, freq: 'monthly', monthDay: 31 })).toMatchObject({
      weekdays: [],
      monthDay: 31,
    });
    expect(toInput({ ...base, freq: 'daily' })).toMatchObject({
      weekdays: [],
      monthDay: undefined,
    });
  });

  it('says what is missing, in the order the form asks', () => {
    const d = emptyRecurring('UTC');
    expect(draftError(d)).toBe('template');
    expect(draftError({ ...d, templateId: 't' })).toBe('project');
    expect(draftError({ ...d, templateId: 't', projectId: 'p', weekdays: [] })).toBe('weekdays');
    expect(draftError({ ...d, templateId: 't', projectId: 'p', freq: 'daily', weekdays: [] })).toBe(
      null,
    );
  });

  it('toggles weekdays and keeps them sorted', () => {
    expect(toggleWeekday([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleWeekday([1, 3], 3)).toEqual([1]);
  });
});

describe('template fields', () => {
  it('turns lines into a list without blanks and with a cap', () => {
    expect(parseLines(' one \n\n two\n   \nthree')).toEqual(['one', 'two', 'three']);
    expect(parseLines('a\nb\nc', 2)).toEqual(['a', 'b']);
  });

  it('reads the due offset', () => {
    expect(parseDueDays('')).toBeNull();
    expect(parseDueDays(' 7 ')).toBe(7);
    expect(parseDueDays('365')).toBe(365);
    expect(parseDueDays('366')).toBeUndefined();
    expect(parseDueDays('-1')).toBeUndefined();
    expect(parseDueDays('2.5')).toBeUndefined();
  });
});
