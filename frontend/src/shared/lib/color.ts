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

export type AccentTokens = Record<
  | 'primary'
  | 'primary-hover'
  | 'primary-solid'
  | 'primary-solid-hover'
  | 'primary-ink'
  | 'primary-soft'
  | 'primary-subtle'
  | 'primary-border',
  Rgb
>;

export const SURFACE_LIGHT: Rgb = WHITE;
export const SURFACE_DARK = DARK_SURFACE;
export const ON_PRIMARY_DARK = DARK_ON_PRIMARY;

/** Text colour that reads (AA) on every tint of the accent: darkened (light theme) or lightened (dark) until it does. */
function inkFor(raw: Rgb, tints: Rgb[], toward: Rgb): Rgb {
  let c = toward === INK ? solidFor(raw) : mix(raw, WHITE, 0.6);
  for (let i = 0; i < 16 && tints.some((t) => contrast(c, t) < 4.5); i++) c = mix(c, toward, 0.1);
  return c;
}

/** The brand tokens derived from one colour, for the light and the dark theme. */
export function accentTokens(accent: string): { light: AccentTokens; dark: AccentTokens } | null {
  if (!isHex(accent)) return null;
  const raw = parseHex(accent);
  const lightSolid = solidFor(raw);
  let darkSolid = mix(raw, WHITE, 0.15);
  for (let i = 0; i < 14 && contrast(darkSolid, DARK_ON_PRIMARY) < 4.5; i++) {
    darkSolid = mix(darkSolid, WHITE, 0.12);
  }
  const lightSoft = mix(raw, WHITE, 0.88);
  const lightSubtle = mix(raw, WHITE, 0.94);
  const darkSoft = mix(raw, DARK_SURFACE, 0.82);
  const darkSubtle = mix(raw, DARK_SURFACE, 0.9);
  return {
    light: {
      primary: raw,
      'primary-hover': mix(raw, INK, 0.1),
      'primary-solid': lightSolid,
      'primary-solid-hover': mix(lightSolid, INK, 0.15),
      'primary-ink': inkFor(raw, [WHITE, lightSoft, lightSubtle], INK),
      'primary-soft': lightSoft,
      'primary-subtle': lightSubtle,
      'primary-border': mix(raw, WHITE, 0.65),
    },
    dark: {
      primary: mix(raw, WHITE, 0.1),
      'primary-hover': mix(raw, WHITE, 0.25),
      'primary-solid': darkSolid,
      'primary-solid-hover': mix(darkSolid, WHITE, 0.15),
      'primary-ink': inkFor(raw, [DARK_SURFACE, darkSoft, darkSubtle], WHITE),
      'primary-soft': darkSoft,
      'primary-subtle': darkSubtle,
      'primary-border': mix(raw, DARK_SURFACE, 0.65),
    },
  };
}

/** The same tokens as CSS, so one <style> element serves both themes (the app switches with `data-theme`). */
export function accentCss(accent: string): string {
  const t = accentTokens(accent);
  if (!t) return '';
  const block = (v: AccentTokens) =>
    Object.entries(v)
      .map(([k, c]) => `--c-${k}:${channels(c)};`)
      .join('');
  return `:root{${block(t.light)}}:root[data-theme='dark']{${block(t.dark)}}`;
}
