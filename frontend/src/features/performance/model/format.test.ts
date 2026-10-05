import { describe, expect, it } from 'vitest';
import { bucketLabel, changePct, sharePct, splitHours } from './format';

describe('performance formatting', () => {
  it('switches to days from two days on', () => {
    expect(splitHours(5.55)).toEqual({ value: 5.6, unit: 'hours' });
    expect(splitHours(47.9)).toEqual({ value: 47.9, unit: 'hours' });
    expect(splitHours(72)).toEqual({ value: 3, unit: 'days' });
  });
  it('has no change without a previous value', () => {
    expect(changePct(10, 0)).toBeNull();
    expect(changePct(null, 5)).toBeNull();
    expect(changePct(15, 10)).toBe(50);
    expect(changePct(5, 10)).toBe(-50);
  });
  it('shares', () => {
    expect(sharePct(1, 3)).toBe(33);
    expect(sharePct(0, 0)).toBeNull();
  });
  it('labels the histogram buckets', () => {
    const edges = [1, 2, 3, 5, 8, 13, null];
    expect(edges.map((_, i) => bucketLabel(edges, i))).toEqual([
      '<1',
      '1–2',
      '2–3',
      '3–5',
      '5–8',
      '8–13',
      '13+',
    ]);
  });
});
