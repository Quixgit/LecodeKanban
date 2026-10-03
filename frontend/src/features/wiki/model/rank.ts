/**
 * Client copy of backend/internal/platform/fractional (base-62 keys compared bytewise), used only
 * to place a node optimistically between two neighbours; the server assigns the stored key.
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const digit = (c: string | undefined) => (c === undefined ? 0 : DIGITS.indexOf(c));

function midpoint(a: string, b: string): string {
  if (b !== '') {
    let n = 0;
    while (n < b.length && (a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a === '' ? 0 : digit(a[0]);
  const db = b === '' ? DIGITS.length : digit(b[0]);
  if (db - da > 1) return DIGITS[Math.floor((da + db + 1) / 2)]!;
  if (b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), '');
}

/** A key strictly between a and b ('' = open end). Falls back to "after a" when a >= b (ties). */
export function rankBetween(a: string, b: string): string {
  if (b !== '' && a >= b) return midpoint(a, '');
  return midpoint(a, b);
}
