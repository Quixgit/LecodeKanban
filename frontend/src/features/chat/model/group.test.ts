import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../api/chatApi';
import { buildFeed, dayLabel } from './group';

const person = (id: string) => ({ id, name: id, avatarUrl: null });
const msg = (
  id: string,
  author: string,
  at: string,
  over: Partial<ChatMessage> = {},
): ChatMessage =>
  ({
    id,
    channelId: 'c',
    parentId: null,
    author: person(author),
    body: id,
    deleted: false,
    mentions: [],
    reactions: [],
    replyCount: 0,
    lastReplyAt: null,
    createdAt: at,
    editedAt: null,
    meeting: null,
    ...over,
  }) as ChatMessage;

describe('buildFeed', () => {
  it('adds a divider per day and groups an author run', () => {
    const feed = buildFeed([
      msg('a', 'u1', '2026-10-01T10:00:00'),
      msg('b', 'u1', '2026-10-01T10:02:00'),
      msg('c', 'u2', '2026-10-01T10:03:00'),
      msg('d', 'u2', '2026-10-02T09:00:00'),
    ]);
    expect(feed.map((i) => (i.type === 'day' ? 'day' : `${i.key}${i.compact ? '+' : ''}`))).toEqual(
      ['day', 'a', 'b+', 'c', 'day', 'd'],
    );
  });

  it('starts a new run after a pause or a deleted message', () => {
    const feed = buildFeed([
      msg('a', 'u1', '2026-10-01T10:00:00'),
      msg('b', 'u1', '2026-10-01T10:30:00'),
      msg('c', 'u1', '2026-10-01T10:31:00', { deleted: true, body: '' }),
      msg('d', 'u1', '2026-10-01T10:32:00'),
    ]);
    const compact = feed
      .filter((i) => i.type === 'message')
      .map((i) => i.type === 'message' && i.compact);
    expect(compact).toEqual([false, false, false, false]);
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 9, 3, 12);
  it('names today and yesterday, formats older days', () => {
    expect(dayLabel(new Date(2026, 9, 3, 1), now, 'en', 'Today', 'Yesterday')).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 2, 23), now, 'en', 'Today', 'Yesterday')).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 8, 1), now, 'en', 'Today', 'Yesterday')).toMatch(/September 1/);
  });
});
