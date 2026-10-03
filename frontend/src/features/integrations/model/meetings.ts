import type { Member } from '@/shared/api';

/** Whole minutes until a start, rounded up; negative once it has begun. */
export function minutesUntil(startsAt: string | Date, now: Date = new Date()): number {
  return Math.ceil((new Date(startsAt).getTime() - now.getTime()) / 60_000);
}

export type Countdown =
  | { kind: 'now' } // it has begun
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hours'; hours: number }
  | { kind: 'at' }; // further away: show the clock time

/** How a start is phrased: "now", "in 25 min", "in 2 h", or just its time. */
export function countdown(startsAt: string | Date, now: Date = new Date()): Countdown {
  const m = minutesUntil(startsAt, now);
  if (m <= 0) return { kind: 'now' };
  if (m < 60) return { kind: 'minutes', minutes: m };
  if (m < 180) return { kind: 'hours', hours: Math.round(m / 60) };
  return { kind: 'at' };
}

/** The workspace members among a meeting's invited addresses (case-insensitive). */
export function matchPeople(emails: readonly string[], members: readonly Member[]) {
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  return members.filter((m) => wanted.has(m.user.email.toLowerCase()));
}
