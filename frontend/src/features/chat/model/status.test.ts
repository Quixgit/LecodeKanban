import { describe, expect, it } from 'vitest';
import type { ChatStatus } from '../api/chatApi';
import { PRESETS, STATUS_ICON_KEYS, presenceOf, untilFor } from './status';

const st = (kind: ChatStatus['kind']): ChatStatus => ({
  userId: 'u',
  kind,
  icon: null,
  text: '',
  until: null,
});

describe('untilFor', () => {
  const now = new Date(2026, 9, 3, 15, 0, 0);
  it('adds the chosen span', () => {
    expect(new Date(untilFor('30m', now)!).getTime() - now.getTime()).toBe(30 * 60_000);
    expect(new Date(untilFor('4h', now)!).getTime() - now.getTime()).toBe(4 * 3_600_000);
    expect(untilFor('never', now)).toBeUndefined();
  });
  it('ends today at the end of the day, or tomorrow when it is nearly midnight', () => {
    const t = new Date(untilFor('today', now)!);
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([3, 23, 59]);
    const late = new Date(2026, 9, 3, 23, 59, 30);
    expect(new Date(untilFor('today', late)!).getDate()).toBe(4);
  });
  it('a week ends next week in the morning', () => {
    const t = new Date(untilFor('week', now)!);
    expect([t.getDate(), t.getHours()]).toEqual([10, 9]);
  });
});

describe('presenceOf', () => {
  it('lets a chosen availability win over online', () => {
    expect(presenceOf(true, st('dnd'))).toBe('dnd');
    expect(presenceOf(true, st('available'))).toBe('online');
    expect(presenceOf(false)).toBe('offline');
    expect(presenceOf(true)).toBe('online');
  });
});

describe('presets', () => {
  it('use icons the server accepts', () => {
    for (const p of PRESETS) expect(STATUS_ICON_KEYS).toContain(p.icon);
  });
});
