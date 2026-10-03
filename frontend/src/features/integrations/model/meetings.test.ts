import { describe, expect, it } from 'vitest';
import type { Member } from '@/shared/api';
import { countdown, matchPeople, minutesUntil } from './meetings';

const now = new Date('2026-10-05T09:00:00Z');
const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString();

describe('countdown', () => {
  it('rounds minutes up and flips to "now" once started', () => {
    expect(minutesUntil(new Date(now.getTime() + 61_000), now)).toBe(2);
    expect(countdown(at(25), now)).toEqual({ kind: 'minutes', minutes: 25 });
    expect(countdown(at(0), now)).toEqual({ kind: 'now' });
    expect(countdown(at(-5), now)).toEqual({ kind: 'now' });
  });

  it('switches to hours, then to a clock time', () => {
    expect(countdown(at(90), now)).toEqual({ kind: 'hours', hours: 2 });
    expect(countdown(at(300), now)).toEqual({ kind: 'at' });
  });
});

describe('matchPeople', () => {
  const member = (email: string): Member =>
    ({
      user: { id: email, name: email, email, avatarUrl: null },
      role: 'member',
      joinedAt: '',
    }) as Member;
  it('finds members by address regardless of case', () => {
    const got = matchPeople(
      ['ANNA@example.com', 'stranger@x.test'],
      [member('anna@example.com'), member('ben@example.com')],
    );
    expect(got.map((m) => m.user.email)).toEqual(['anna@example.com']);
  });
});
