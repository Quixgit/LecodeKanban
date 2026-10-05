/** Colour maths for user-chosen accents: parsing, contrast (WCAG), and a token set derived from one colour. */
export type Rgb = readonly [number, number, number];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: string) => HEX.test(v);

export function parseHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** "r g b" as the design tokens store channels. */
export const channels = (c: Rgb) => `${c[0]} ${c[1]} ${c[2]}`;

export const WHITE: Rgb = [255, 255, 255];
export const INK: Rgb = [20, 20, 22];

/** Darken the colour until white text on it reads (AA), for buttons. */
export function solidFor(accent: Rgb, text: Rgb = WHITE, background: Rgb = INK): Rgb {
  let c = accent;
  for (let i = 0; i < 14 && contrast(c, text) < 4.5; i++) c = mix(c, background, 0.12);
  return c;
}

const DARK_SURFACE: Rgb = [21, 25, 25];
const DARK_ON_PRIMARY: Rgb = [6, 26, 24];

/**
 * The brand tokens derived from one colour, for the light and the dark theme. Returned as CSS so a single
 * <style> element can serve both (the app switches themes with `data-theme` on the root).
 */
export function accentCss(accent: string): string {
  if (!isHex(accent)) return '';
  const raw = parseHex(accent);
  const lightSolid = solidFor(raw);
  // Dark theme: a lighter solid with dark text on it.
  let darkSolid = mix(raw, WHITE, 0.15);
  for (let i = 0; i < 14 && contrast(darkSolid, DARK_ON_PRIMARY) < 4.5; i++) {
    darkSolid = mix(darkSolid, WHITE, 0.12);
  }
  const light = {
    primary: raw,
    'primary-hover': mix(raw, INK, 0.1),
    'primary-solid': lightSolid,
    'primary-solid-hover': mix(lightSolid, INK, 0.15),
    'primary-ink': lightSolid,
    'primary-soft': mix(raw, WHITE, 0.88),
    'primary-subtle': mix(raw, WHITE, 0.94),
    'primary-border': mix(raw, WHITE, 0.65),
  };
  const dark = {
    primary: mix(raw, WHITE, 0.1),
    'primary-hover': mix(raw, WHITE, 0.25),
    'primary-solid': darkSolid,
    'primary-solid-hover': mix(darkSolid, WHITE, 0.15),
    'primary-ink': mix(raw, WHITE, 0.6),
    'primary-soft': mix(raw, DARK_SURFACE, 0.82),
    'primary-subtle': mix(raw, DARK_SURFACE, 0.9),
    'primary-border': mix(raw, DARK_SURFACE, 0.65),
  };
  const block = (v: Record<string, Rgb>) =>
    Object.entries(v)
      .map(([k, c]) => `--c-${k}:${channels(c)};`)
      .join('');
  return `:root{${block(light)}}:root[data-theme='dark']{${block(dark)}}`;
}
