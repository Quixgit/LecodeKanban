import { describe, expect, it } from 'vitest';
import { fileNameFor, looksLikeMarkdown } from './markdown';

describe('looksLikeMarkdown', () => {
  it.each([
    ['# Title\n\nSome text', true],
    ['- one\n- two', true],
    ['1. one\n2. two', true],
    ['- [ ] todo\n- [x] done', true],
    ['> quoted\n> more', true],
    ['```bash\nls\n```', true],
    ['| a | b |\n| --- | --- |\n| 1 | 2 |', true],
    ['see [docs](https://example.com) now', true],
    ['this is **important**', true],
    ['Just a normal sentence.', false],
    ['Two lines\nof plain text', false],
    ['3 - 2 = 1', false],
    ['', false],
  ])('%j → %s', (text, expected) => expect(looksLikeMarkdown(text)).toBe(expected));
});

describe('fileNameFor', () => {
  it('keeps Cyrillic and strips path characters', () => {
    expect(fileNameFor('Ранбук: PostgreSQL/failover?', 'md')).toBe('Ранбук PostgreSQL failover.md');
    expect(fileNameFor('   ', 'md')).toBe('page.md');
    expect(fileNameFor('a'.repeat(200), 'md')).toHaveLength(83);
  });
});
