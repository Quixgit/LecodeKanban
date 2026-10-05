import { describe, expect, it } from 'vitest';
import { PRESETS, accentVars, contrast, parseHex, sidebarVars, solidAccent } from './theme';

const WHITE = [255, 255, 255] as const;

describe('chat theme', () => {
  it('leaves the default look alone', () => {
    const d = PRESETS[0]!;
    expect(accentVars(d)).toEqual({});
    expect(sidebarVars(d)).toEqual({});
  });

  it('makes white text readable on every preset accent', () => {
    for (const p of PRESETS)
      expect(contrast(solidAccent(parseHex(p.accent)), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('turns text light on a dark sidebar and dark on a light one', () => {
    const dark = sidebarVars({ sidebar: '#3f0e40', accent: '#7c3085' }) as Record<string, string>;
    const light = sidebarVars({ sidebar: '#e6f4f1', accent: '#2a7f78' }) as Record<string, string>;
    const lum = (v: string) => Number(v.split(' ')[0]);
    expect(lum(dark['--c-text']!)).toBeGreaterThan(200);
    expect(lum(light['--c-text']!)).toBeLessThan(60);
  });

  it('keeps muted text readable on every preset sidebar', () => {
    for (const p of PRESETS.slice(1)) {
      const v = sidebarVars(p) as Record<string, string>;
      const rgb = (s: string) => s.split(' ').map(Number) as [number, number, number];
      expect(contrast(rgb(v['--c-text-muted']!), rgb(v['--c-surface']!))).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
