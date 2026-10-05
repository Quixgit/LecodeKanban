import { describe, expect, it } from 'vitest';
import { clock, compact, parseDuration, splitDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['1h 30m', 5400],
    ['1.5h', 5400],
    ['1,5 h', 5400],
    ['90', 5400],
    ['90m', 5400],
    ['1:30', 5400],
    ['2г 15хв', 8100],
    ['45 хв', 2700],
    ['  3 hours ', 10800],
  ])('%s → %d s', (input, want) => expect(parseDuration(input)).toBe(want));

  it.each(['', 'abc', '1x', '0', '1h foo', '-5'])('rejects %j', (input) =>
    expect(parseDuration(input)).toBeNull(),
  );
});

describe('formatting', () => {
  it('splits and pads', () => {
    expect(splitDuration(3725)).toEqual({ h: 1, m: 2, s: 5 });
    expect(clock(65)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(-3)).toBe('0:00');
  });
});

describe('compact', () => {
  it('writes h:mm, rounding up from the first second', () => {
    expect(compact(0)).toBe('');
    expect(compact(20)).toBe('0:01');
    expect(compact(5400)).toBe('1:30');
    expect(compact(8 * 3600 + 59 * 60)).toBe('8:59');
  });
});
