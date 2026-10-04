/** The time in another time zone, and how far it is from `reference`'s; null when the zone is unknown. */
export function localTimeIn(
  timeZone: string,
  locale: string,
  now: Date = new Date(),
  reference?: string,
): { time: string; offsetHours: number } | null {
  if (!timeZone) return null;
  try {
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(now);
    const mine = reference ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { time, offsetHours: (zoneMinutes(timeZone, now) - zoneMinutes(mine, now)) / 60 };
  } catch {
    return null;
  }
}

/** Minutes the zone is ahead of UTC at `at`. */
function zoneMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return (asUtc - at.setSeconds(0, 0)) / 60000;
}

/** True when `now` falls inside the working hours (HH:MM) in the person's own zone. */
export function isWorkingNow(
  start: string,
  end: string,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (!start || !end) return false;
  try {
    const t = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timeZone || undefined,
    }).format(now);
    return t >= start && t < end;
  } catch {
    return false;
  }
}
