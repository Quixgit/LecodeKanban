import { describe, expect, it } from 'vitest';
import type { ChatChannel } from '../api/chatApi';
import { hasAnyFilter, parseQuery, rangeStart, suggest } from './searchQuery';

const ch = (id: string, name: string, over: Partial<ChatChannel> = {}): ChatChannel =>
  ({
    id,
    workspaceId: 'w',
    kind: 'public',
    name,
    topic: '',
    joined: true,
    muted: false,
    notify: 'all',
    starred: false,
    unread: 0,
    mentions: 0,
    memberCount: 1,
    lastMessageAt: null,
    people: [],
    feedEvents: [],
    ...over,
  }) as ChatChannel;
const channels = [ch('c1', 'dev-ops'), ch('c2', 'design')];
const people = [
  { id: 'p1', name: 'Anna Sarkisian' },
  { id: 'p2', name: 'Ben' },
];
const parse = (s: string) => parseQuery(s, channels, people, 'me', 'You');

describe('parseQuery', () => {
  it('turns complete modifiers into filters and keeps the rest as text', () => {
    const r = parse('release in:#dev-ops from:@annasarkisian has:link is:thread with:me notes ');
    expect(r.text).toBe('release notes');
    expect(r.filters).toMatchObject({
      channel: { id: 'c1' },
      from: { id: 'p1' },
      hasLink: true,
      threads: true,
      mentionsMe: true,
    });
    expect(r.partial).toBeUndefined();
  });
  it('treats from:me as the caller', () => {
    expect(parse('from:me ').filters.from).toEqual({ id: 'me', name: 'You' });
  });
  it('offers suggestions for a half-typed modifier at the end', () => {
    expect(parse('plan in:de').partial).toEqual({ kind: 'in', term: 'de' });
    expect(parse('from:an').partial).toEqual({ kind: 'from', term: 'an' });
    expect(parse('plan in:de').text).toBe('plan');
  });
  it('keeps unknown modifiers as plain text', () => {
    expect(parse('in:nowhere ').text).toBe('in:nowhere');
    expect(parse('foo:bar baz').text).toBe('foo:bar baz');
  });
});

describe('suggest', () => {
  it('ranks prefix matches first and includes only joined or public channels', () => {
    const list = [...channels, ch('c3', 'secret', { kind: 'private', joined: false })];
    expect(
      suggest({ kind: 'in', term: 'de' }, list, people, 'me', 'You').map((s) => s.label),
    ).toEqual(['design', 'dev-ops']);
    expect(suggest({ kind: 'in', term: 'sec' }, list, people, 'me', 'You')).toEqual([]);
    expect(
      suggest({ kind: 'from', term: 'be' }, channels, people, 'me', 'You').map((s) => s.id),
    ).toEqual(['p2']);
  });
});

describe('filters helpers', () => {
  it('knows when any filter is active', () => {
    expect(hasAnyFilter({})).toBe(false);
    expect(hasAnyFilter({ hasFile: true })).toBe(true);
  });
  it('computes date ranges', () => {
    const now = new Date('2026-10-10T15:30:00');
    expect(new Date(rangeStart('day', now)).getHours()).toBe(0);
    expect(new Date(rangeStart('week', now)).getTime()).toBe(now.getTime() - 7 * 86_400_000);
  });
});
