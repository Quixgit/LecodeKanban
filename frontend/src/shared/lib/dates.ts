/** Today's calendar date as YYYY-MM-DD (UTC, matching the API's date semantics). */
export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True when an ISO date (YYYY-MM-DD) is strictly before today. */
export function isPast(date: string | null | undefined, now = new Date()): boolean {
  return !!date && date < todayISO(now);
}

/** Days from today to an ISO date (negative = past). */
export function daysUntil(date: string, now = new Date()): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayISO(now)}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
