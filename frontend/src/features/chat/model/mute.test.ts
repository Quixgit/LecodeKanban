import { describe, expect, it } from 'vitest';
import { muteUntil } from './mute';

describe('muteUntil', () => {
  const now = new Date(2026, 9, 7, 15, 30); // Wednesday 7 October 2026, 15:30 local
  it('counts hours from now', () => {
    expect(new Date(muteUntil('hour', now)).getTime() - now.getTime()).toBe(3_600_000);
    expect(new Date(muteUntil('fourHours', now)).getTime() - now.getTime()).toBe(4 * 3_600_000);
  });
  it('lifts tomorrow at nine', () => {
    const d = new Date(muteUntil('tomorrow', now));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([8, 9, 0]);
  });
  it('lifts next Monday at nine, even when today is Monday or Sunday', () => {
    const wed = new Date(muteUntil('nextWeek', now));
    expect([wed.getDay(), wed.getDate(), wed.getHours()]).toEqual([1, 12, 9]);
    const mon = new Date(muteUntil('nextWeek', new Date(2026, 9, 5, 10)));
    expect([mon.getDay(), mon.getDate()]).toEqual([1, 12]);
    const sun = new Date(muteUntil('nextWeek', new Date(2026, 9, 11, 10)));
    expect([sun.getDay(), sun.getDate()]).toEqual([1, 12]);
  });
});
