import { describe, expect, it } from 'vitest';
import { normalizeEmoji, searchEmoji, withTone } from './emoji';

const raw = [
  { unicode: '🇦', label: 'regional indicator A' },
  { unicode: '🏻', label: 'light skin tone', group: 2 },
  { unicode: '😀', label: 'grinning face', group: 0, tags: ['grin', 'smile'] },
  {
    unicode: '👋',
    label: 'waving hand',
    group: 1,
    tags: ['hello', 'wave'],
    skins: [
      { unicode: '👋🏻', tone: 1 },
      { unicode: '👋🏿', tone: 5 },
      { unicode: '🫱🏻‍🫲🏿', tone: [1, 5] },
    ],
  },
];

describe('emoji data', () => {
  const all = normalizeEmoji(raw);
  it('drops components and entries without a group', () => {
    expect(all.map((e) => e.unicode)).toEqual(['😀', '👋']);
  });
  it('searches name and tags, all words must match', () => {
    expect(searchEmoji(all, 'smile').map((e) => e.unicode)).toEqual(['😀']);
    expect(searchEmoji(all, 'wav hel').map((e) => e.unicode)).toEqual(['👋']);
    expect(searchEmoji(all, 'wave smile')).toEqual([]);
    expect(searchEmoji(all, '  ')).toEqual([]);
  });
  it('applies a skin tone only where one exists', () => {
    const [grin, wave] = all as [(typeof all)[number], (typeof all)[number]];
    expect(withTone(wave, 5)).toBe('👋🏿');
    expect(withTone(wave, 0)).toBe('👋');
    expect(withTone(grin, 3)).toBe('😀');
    expect(wave.skins).toHaveLength(2); // multi-person tones are not offered
  });
});
