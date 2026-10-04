import type { CSSProperties } from 'react';

/** A chat colour theme: the sidebar colour and the accent (send button, active channel, links). */
export interface ChatTheme {
  sidebar: string; // #rrggbb
  accent: string; // #rrggbb
}

export interface ChatPreset extends ChatTheme {
  id: string;
}

/** Ready-made looks, in the spirit of Slack's sidebar themes. `default` follows the app's own colours. */
export const PRESETS: readonly ChatPreset[] = [
  { id: 'default', sidebar: '#ffffff', accent: '#36827d' },
  { id: 'aubergine', sidebar: '#3f0e40', accent: '#7c3085' },
  { id: 'ocean', sidebar: '#0b3c5d', accent: '#1d6fa5' },
  { id: 'forest', sidebar: '#1b3a2d', accent: '#2f7d4f' },
  { id: 'sunset', sidebar: '#5b2333', accent: '#c2410c' },
  { id: 'graphite', sidebar: '#25272b', accent: '#5b6472' },
  { id: 'mint', sidebar: '#e6f4f1', accent: '#2a7f78' },
  { id: 'sand', sidebar: '#f6efe3', accent: '#9a5b13' },
];

export const DEFAULT_THEME: ChatTheme = {
  sidebar: PRESETS[0]!.sidebar,
  accent: PRESETS[0]!.accent,
};

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: string) => HEX.test(v);

type Rgb = readonly [number, number, number];

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

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const ch = (c: Rgb) => `${c[0]} ${c[1]} ${c[2]}`;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [20, 20, 22];

/** Darken the accent until white text on it reads (WCAG AA), for buttons and text on light grounds. */
export function solidAccent(accent: Rgb): Rgb {
  let c = accent;
  for (let i = 0; i < 12 && contrast(c, WHITE) < 4.5; i++) c = mix(c, BLACK, 0.12);
  return c;
}

/** Is this the unchanged default look (no overrides needed)? */
export const isDefault = (t: ChatTheme) =>
  t.sidebar.toLowerCase() === DEFAULT_THEME.sidebar &&
  t.accent.toLowerCase() === DEFAULT_THEME.accent;

/** Variables for the whole chat: the accent. */
export function accentVars(theme: ChatTheme): CSSProperties {
  if (isDefault(theme) || !isHex(theme.accent)) return {};
  const solid = solidAccent(parseHex(theme.accent));
  const hover = mix(solid, BLACK, 0.15);
  const raw = parseHex(theme.accent);
  return {
    '--c-primary': ch(raw),
    '--c-primary-hover': ch(mix(raw, BLACK, 0.1)),
    '--c-primary-solid': ch(solid),
    '--c-primary-solid-hover': ch(hover),
    '--c-primary-ink': ch(solid),
    '--c-primary-soft': ch(mix(raw, WHITE, 0.88)),
    '--c-primary-subtle': ch(mix(raw, WHITE, 0.93)),
    '--c-primary-border': ch(mix(raw, WHITE, 0.65)),
  } as CSSProperties;
}

/** Variables for the channel list: its ground and, on a dark ground, light text and an accent-filled active row. */
export function sidebarVars(theme: ChatTheme): CSSProperties {
  if (isDefault(theme) || !isHex(theme.sidebar)) return {};
  const bg = parseHex(theme.sidebar);
  const dark = contrast(bg, WHITE) >= contrast(bg, BLACK);
  const text = dark ? WHITE : BLACK;
  const accent = isHex(theme.accent) ? parseHex(theme.accent) : parseHex(DEFAULT_THEME.accent);
  const edge = mix(bg, text, 0.14);
  const vars: Record<string, string> = {
    '--c-surface': ch(bg),
    '--c-surface-muted': ch(mix(bg, text, dark ? 0.1 : 0.05)),
    '--c-surface-sunken': ch(mix(bg, text, dark ? 0.16 : 0.09)),
    '--c-border': ch(edge),
    '--c-border-subtle': ch(mix(bg, text, 0.09)),
    '--c-border-strong': ch(mix(bg, text, 0.24)),
    '--c-text': ch(text),
    '--c-text-secondary': ch(mix(bg, text, 0.9)),
    '--c-text-muted': ch(mix(bg, text, 0.78)),
    '--c-text-faint': ch(mix(bg, text, 0.6)),
  };
  if (dark) {
    // The active row: the accent itself, with white text.
    vars['--c-primary-subtle'] = ch(mix(bg, accent, 0.7));
    vars['--c-primary-border'] = ch(mix(bg, accent, 0.85));
    vars['--c-primary-ink'] = ch(WHITE);
    vars['--c-primary-solid'] = ch(solidAccent(accent));
    vars['--c-on-primary'] = ch(WHITE);
  }
  return vars as CSSProperties;
}
