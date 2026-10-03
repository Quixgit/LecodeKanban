import { describe, expect, it } from 'vitest';
import type { ChatChannel } from '../api/chatApi';
import { channelTitle, groupChannels, normalizeChannelName } from './channels';

const p = (id: string, name: string) => ({ id, name, avatarUrl: null });
const ch = (over: Partial<ChatChannel>): ChatChannel => ({
  id: 'x',
  workspaceId: 'w',
  kind: 'public',
  name: 'general',
  topic: '',
  joined: true,
  muted: false,
  unread: 0,
  mentions: 0,
  memberCount: 1,
  lastMessageAt: null,
  people: [],
  ...over,
});

describe('channelTitle', () => {
  it('uses the channel name, or the other people of a conversation', () => {
    expect(channelTitle(ch({}), 'me', 'you')).toBe('general');
    const dm = ch({
      kind: 'dm',
      name: null,
      people: [p('me', 'Me'), p('a', 'Anna'), p('b', 'Ben')],
    });
    expect(channelTitle(dm, 'me', 'you')).toBe('Anna, Ben');
  });
  it('marks notes to self', () => {
    const self = ch({ kind: 'dm', name: null, people: [p('me', 'Me')] });
    expect(channelTitle(self, 'me', 'you')).toBe('Me (you)');
  });
});

describe('groupChannels', () => {
  it('lists joined channels by name, conversations by recency, and all public ones to browse', () => {
    const g = groupChannels([
      ch({ id: '1', name: 'zeta' }),
      ch({ id: '2', name: 'alpha' }),
      ch({ id: '3', name: 'open', joined: false }),
      ch({ id: '4', kind: 'private', name: 'secret' }),
      ch({ id: '5', kind: 'dm', name: null, lastMessageAt: '2026-10-01T00:00:00Z' }),
      ch({ id: '6', kind: 'dm', name: null, lastMessageAt: '2026-10-02T00:00:00Z' }),
    ]);
    expect(g.channels.map((c) => c.id)).toEqual(['2', '4', '1']);
    expect(g.direct.map((c) => c.id)).toEqual(['6', '5']);
    expect(g.browsable.map((c) => c.id)).toEqual(['2', '3', '1']);
  });
});

describe('normalizeChannelName', () => {
  it('mirrors the server rule', () => {
    expect(normalizeChannelName('  #Release Planning ')).toBe('release-planning');
  });
});
