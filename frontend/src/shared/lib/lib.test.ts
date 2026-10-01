import { describe, expect, it } from 'vitest';
import { formatDate, formatPercent } from './format';
import { hueFor, initials } from './initials';
import { pageWindow } from './pageWindow';

describe('initials', () => {
  it.each([
    ['Peter Gabrielle', 'PG'],
    ['  lisa   kim ', 'LK'],
    ['Mary Jane Watson', 'MW'],
    ['Cher', 'CH'],
    ['', '?'],
  ])('%s → %s', (name, expected) => expect(initials(name)).toBe(expected));

  it('gives a stable hue per name', () => {
    expect(hueFor('Lisa Kim')).toBe(hueFor('Lisa Kim'));
  });
});

describe('pageWindow', () => {
  it('lists all pages when there are few', () => expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]));
  it('matches the screenshot pattern 1 2 3 … 7', () =>
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 'gap', 7]));
  it('keeps neighbours of the current page', () =>
    expect(pageWindow(5, 10)).toEqual([1, 2, 3, 4, 5, 6, 'gap', 10]));
});

describe('format', () => {
  it('formats long dates per locale', () => {
    expect(formatDate('2025-06-10', 'en')).toBe('June 10, 2025');
    expect(formatDate('2025-06-10', 'uk')).toBe('10 червня 2025 р.');
  });

  it('formats percentages with locale separators', () => {
    expect(formatPercent(1.5, 'en', 2)).toBe('1.50%');
    expect(formatPercent(1.5, 'uk', 2)).toMatch(/^1,50\s?%$/);
  });
});
