import { describe, expect, it } from 'vitest';
import { resolveTheme } from './themeStore';

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ] as const)('%s (system dark=%s) → %s', (pref, sys, out) =>
    expect(resolveTheme(pref, sys)).toBe(out),
  );
});
