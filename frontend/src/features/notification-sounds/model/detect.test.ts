import { describe, expect, it } from 'vitest';
import { detectChatSound, type ChannelCounts } from './detect';
import { strongest } from './synth';

const c = (over: Partial<ChannelCounts> = {}): ChannelCounts => ({
  unread: 0,
  mentions: 0,
  muted: false,
  joined: true,
  ...over,
});
const snap = (o: Record<string, ChannelCounts>) => new Map(Object.entries(o));

describe('detectChatSound', () => {
  it('rings for a new message and louder for a mention', () => {
    expect(detectChatSound(snap({ a: c() }), snap({ a: c({ unread: 1 }) }), undefined)).toBe(
      'message',
    );
    expect(
      detectChatSound(snap({ a: c() }), snap({ a: c({ unread: 1, mentions: 1 }) }), undefined),
    ).toBe('mention');
  });
  it('stays quiet for muted, unjoined, watched and unchanged channels', () => {
    const grown = c({ unread: 2 });
    expect(
      detectChatSound(snap({ a: c() }), snap({ a: { ...grown, muted: true } }), undefined),
    ).toBeUndefined();
    expect(
      detectChatSound(snap({ a: c() }), snap({ a: { ...grown, joined: false } }), undefined),
    ).toBeUndefined();
    expect(detectChatSound(snap({ a: c() }), snap({ a: grown }), 'a')).toBeUndefined();
    expect(detectChatSound(snap({ a: grown }), snap({ a: grown }), undefined)).toBeUndefined();
  });
  it('ignores channels that just appeared (first load) and reading', () => {
    expect(detectChatSound(snap({}), snap({ a: c({ unread: 5 }) }), undefined)).toBeUndefined();
    expect(
      detectChatSound(snap({ a: c({ unread: 3 }) }), snap({ a: c() }), undefined),
    ).toBeUndefined();
  });
});

describe('strongest', () => {
  it('picks the most important of simultaneous sounds', () => {
    expect(strongest(['notify', 'task', 'mention', 'message'])).toBe('mention');
    expect(strongest(['notify', 'task'])).toBe('task');
    expect(strongest([])).toBeUndefined();
  });
});

describe('detectChatSound for task feeds', () => {
  it('rings the task sound for a feed, and a message elsewhere does not mask a mention', () => {
    const feed = (unread: number) => c({ unread, feed: true });
    expect(detectChatSound(snap({ f: feed(0) }), snap({ f: feed(2) }), undefined)).toBe('task');
    expect(
      detectChatSound(
        snap({ f: feed(0), a: c() }),
        snap({ f: feed(1), a: c({ unread: 1, mentions: 1 }) }),
        undefined,
      ),
    ).toBe('mention');
  });
});
