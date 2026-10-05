/** Hours read better as days once a task took two days or more. */
export function splitHours(hours: number): { value: number; unit: 'hours' | 'days' } {
  const round = (n: number) => Math.round(n * 10) / 10;
  return hours < 48
    ? { value: round(hours), unit: 'hours' }
    : { value: round(hours / 24), unit: 'days' };
}

/** Percent change from `previous` to `current`; null when there is nothing to compare against. */
export function changePct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Whole-number share of `part` in `whole`; null for an empty whole. */
export function sharePct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Label of a cycle-time bucket in days: "<1", "1–2", … "13+". */
export function bucketLabel(edges: (number | null)[], index: number): string {
  const upTo = edges[index];
  const from = index === 0 ? null : edges[index - 1];
  if (upTo === null) return `${from}+`;
  return from === null ? `<${upTo}` : `${from}–${upTo}`;
}
