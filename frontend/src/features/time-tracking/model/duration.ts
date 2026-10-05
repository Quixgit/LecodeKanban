/**
 * Duration helpers. Parsing is forgiving ("1h 30m", "1.5h", "90", "1:30", "2г 15хв"); a bare number
 * means minutes.
 */

const TOKEN = /(\d+(?:[.,]\d+)?)\s*([a-zа-яіїєґ]+)/giu;

const positive = (n: number) => (n > 0 ? n : null);

export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
  if (clock) return positive(Number(clock[1]) * 3600 + Number(clock[2]) * 60);
  if (/^\d+(?:[.,]\d+)?$/.test(text))
    return positive(Math.round(Number(text.replace(',', '.')) * 60));

  let total = 0;
  let rest = text;
  for (const m of text.matchAll(TOKEN)) {
    const value = Number(m[1]!.replace(',', '.'));
    const unit = m[2]!;
    if (/^(h|hr|hrs|hour|hours|г|год|година|години|годин)$/u.test(unit)) total += value * 3600;
    else if (/^(m|min|mins|minute|minutes|хв|хвилина|хвилини|хвилин)$/u.test(unit))
      total += value * 60;
    else return null;
    rest = rest.replace(m[0], '');
  }
  return rest.trim() === '' ? positive(Math.round(total)) : null;
}

/** Splits seconds into whole hours / minutes / seconds. */
export function splitDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "1:05:09" — for live timers. */
export function clock(seconds: number): string {
  const { h, m, s } = splitDuration(seconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "2:30" — hours and minutes for dense tables; "" for nothing. */
export function compact(seconds: number): string {
  if (seconds <= 0) return '';
  const total = Math.max(1, Math.round(seconds / 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
