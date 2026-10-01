import { describe, expect, it } from 'vitest';
import { i18n, testResources } from '@/test/i18n';
import { normalizeLanguage } from './config';

describe('normalizeLanguage', () => {
  it.each([
    ['uk-UA', 'uk'],
    ['en-GB', 'en'],
    ['UK', 'uk'],
    ['de-DE', 'en'],
    [undefined, 'en'],
  ])('%s → %s', (tag, lng) => expect(normalizeLanguage(tag)).toBe(lng));
});

describe('Ukrainian plurals (one / few / many)', () => {
  const t = i18n.getFixedT('uk', 'common');
  it.each([
    [1, '1 задача'],
    [3, '3 задачі'],
    [5, '5 задач'],
    [11, '11 задач'],
    [21, '21 задача'],
    [24, '24 задачі'],
  ])('%i', (count, text) => expect(t('tasksCount', { count })).toBe(text));
});

function flatKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatKeys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`.replace(/_(one|few|many|other)$/, '')],
  );
}

describe('locale parity', () => {
  it.each(Object.keys(testResources.en))('namespace %s has the same keys in en and uk', (ns) => {
    const en = new Set(flatKeys(testResources.en[ns as keyof typeof testResources.en]));
    const uk = new Set(flatKeys(testResources.uk[ns as keyof typeof testResources.uk]));
    expect([...en].filter((k) => !uk.has(k))).toEqual([]);
    expect([...uk].filter((k) => !en.has(k))).toEqual([]);
  });
});
