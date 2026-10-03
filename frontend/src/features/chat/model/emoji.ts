export interface Emoji {
  /** The character(s) to insert. */
  unicode: string;
  label: string;
  tags: string[];
  group: number;
  /** Skin-tone variants (1–5 = light … dark), when the emoji has them. */
  skins?: { unicode: string; tone: number }[];
}

/** Emoji groups in display order (the data set's numbers; 2 holds components and is skipped). */
export const EMOJI_GROUPS = [0, 1, 3, 4, 5, 6, 7, 8, 9] as const;
export type EmojiGroup = (typeof EMOJI_GROUPS)[number];

interface RawEmoji {
  unicode: string;
  label: string;
  group?: number;
  tags?: string[];
  skins?: { unicode: string; tone?: number | number[] }[];
}

/** Keeps real emoji (not regional-indicator letters or skin-tone swatches) and normalises the shape. */
export function normalizeEmoji(raw: readonly RawEmoji[]): Emoji[] {
  const out: Emoji[] = [];
  for (const r of raw) {
    if (r.group === undefined || r.group === 2) continue;
    const skins = r.skins
      ?.filter((s): s is { unicode: string; tone: number } => typeof s.tone === 'number')
      .map((s) => ({ unicode: s.unicode, tone: s.tone }));
    out.push({ unicode: r.unicode, label: r.label, tags: r.tags ?? [], group: r.group, skins });
  }
  return out;
}

/** The emoji with the chosen skin tone (0 = default), when it has one. */
export function withTone(e: Emoji, tone: number): string {
  if (tone === 0) return e.unicode;
  return e.skins?.find((s) => s.tone === tone)?.unicode ?? e.unicode;
}

/** Case-insensitive match on name and tags; every word of the query must match. */
export function searchEmoji(all: readonly Emoji[], query: string, limit = 120): Emoji[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const out: Emoji[] = [];
  for (const e of all) {
    const hay = `${e.label} ${e.tags.join(' ')}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const cache = new Map<string, Promise<Emoji[]>>();

/** Loads the emoji names for a language on first use (about 100 KB compressed, never in the main bundle). */
export function loadEmoji(lang: string): Promise<Emoji[]> {
  const key = lang === 'uk' ? 'uk' : 'en';
  let p = cache.get(key);
  if (!p) {
    p = (
      key === 'uk'
        ? import('emojibase-data/uk/compact.json')
        : import('emojibase-data/en/compact.json')
    ).then((m) => normalizeEmoji(m.default as unknown as RawEmoji[]));
    cache.set(key, p);
  }
  return p;
}

/** The eight reactions offered first, like Slack's quick row. */
export const QUICK_REACTIONS = ['👍', '❤️', '✅', '🎉', '👀', '😂', '🔥', '💡'] as const;
