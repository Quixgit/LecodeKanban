import { describe, expect, it } from 'vitest';
import type { AppNotification } from '../api/notificationsApi';
import { freshIds, soundFor, targetOf } from './describe';

const base: AppNotification = {
  id: 'n1',
  kind: 'assigned',
  title: 'PLT-1 Fix login',
  body: '',
  actor: null,
  cardId: 'c1',
  projectId: null,
  channelId: null,
  messageId: null,
  link: null,
  createdAt: '2026-10-03T10:00:00Z',
  read: false,
};

describe('notifications', () => {
  it('leads to the task or the conversation', () => {
    expect(targetOf(base)).toEqual({ card: 'c1' });
    expect(targetOf({ ...base, cardId: null, channelId: 'ch1', kind: 'dm' })).toEqual({
      channel: 'ch1',
    });
    expect(targetOf({ ...base, cardId: null })).toBeNull();
    expect(
      targetOf({ ...base, cardId: null, kind: 'meeting', link: 'https://meet.test/x' }),
    ).toEqual({
      link: 'https://meet.test/x',
    });
  });

  it('rings for task kinds only', () => {
    expect(soundFor(base)).toBe('task');
    expect(soundFor({ ...base, kind: 'task_commented' })).toBe('notify');
    expect(soundFor({ ...base, kind: 'meeting' })).toBe('notify');
    expect(soundFor({ ...base, kind: 'mention' })).toBeUndefined();
    expect(soundFor({ ...base, kind: 'dm' })).toBeUndefined();
  });

  it('finds unread notifications that appeared after the baseline', () => {
    const next = { ...base, id: 'n2' };
    const seen = { ...base, id: 'n3', read: true };
    expect(freshIds(null, [base, next])).toEqual([]);
    expect(freshIds(new Set(['n1']), [next, base, seen])).toEqual(['n2']);
  });
});
