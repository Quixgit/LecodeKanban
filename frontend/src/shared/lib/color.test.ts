import { describe, expect, it } from 'vitest';
import { ACCENTS } from '@/features/settings/model/workspaceLook';
import {
  ON_PRIMARY_DARK,
  SURFACE_DARK,
  SURFACE_LIGHT,
  WHITE,
  accentTokens,
  contrast,
} from './color';

const AA = 4.5;

describe('workspace accent colours stay readable', () => {
  // Every offered accent, plus extremes an administrator could pick with the colour picker.
  const picks = [
    ...ACCENTS.filter(Boolean),
    '#ffff00',
    '#00ff00',
    '#000000',
    '#ffffff',
    '#808080',
    '#ff00ff',
  ];
  for (const accent of picks) {
    it(`${accent}: buttons, links and tints pass AA in both themes`, () => {
      const t = accentTokens(accent)!;
      // Light: white text on a button, ink on white and on both tints.
      expect(contrast(t.light['primary-solid'], WHITE)).toBeGreaterThanOrEqual(AA);
      for (const bg of [SURFACE_LIGHT, t.light['primary-soft'], t.light['primary-subtle']])
        expect(contrast(t.light['primary-ink'], bg)).toBeGreaterThanOrEqual(AA);
      // Dark: dark text on a button, ink on the dark surface and on both tints.
      expect(contrast(t.dark['primary-solid'], ON_PRIMARY_DARK)).toBeGreaterThanOrEqual(AA);
      for (const bg of [SURFACE_DARK, t.dark['primary-soft'], t.dark['primary-subtle']])
        expect(contrast(t.dark['primary-ink'], bg)).toBeGreaterThanOrEqual(AA);
    });
  }
});
