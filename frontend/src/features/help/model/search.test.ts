import { describe, expect, it } from 'vitest';
import { searchHelp, type HelpEntry } from './search';

const e = (id: string, title: string, body = ''): HelpEntry => ({
  id,
  kind: 'guide',
  title,
  hint: '',
  body,
  to: `/help#${id}`,
});
const entries = [
  e('a', 'Deleted tasks and restoring', 'trash undo'),
  e('b', 'Work on the board', 'drag cards between columns'),
  e('c', 'Roles and permissions', 'restoring access'),
  e('d', 'Двофакторний вхід', '2fa автентифікатор'),
];

describe('help search', () => {
  it('needs every word to match', () => {
    expect(searchHelp(entries, 'board drag').map((x) => x.id)).toEqual(['b']);
    expect(searchHelp(entries, 'board trash')).toEqual([]);
  });
  it('ranks a title hit above a body hit', () => {
    expect(searchHelp(entries, 'restoring').map((x) => x.id)).toEqual(['a', 'c']);
  });
  it('is case-insensitive and works in Ukrainian', () => {
    expect(searchHelp(entries, 'ДВОФАКТОРНИЙ').map((x) => x.id)).toEqual(['d']);
    expect(searchHelp(entries, 'двофактор').map((x) => x.id)).toEqual(['d']);
    expect(searchHelp(entries, '2FA').map((x) => x.id)).toEqual(['d']);
  });
  it('returns nothing for an empty query', () => {
    expect(searchHelp(entries, '  ')).toEqual([]);
  });
});
