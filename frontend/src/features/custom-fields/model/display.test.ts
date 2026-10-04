import { describe, expect, it } from 'vitest';
import type { CustomField } from '../api/fieldsApi';
import { chipsFor, displayValue } from './display';

const f = (over: Partial<CustomField>): CustomField => ({
  id: 'f1',
  name: 'Field',
  description: '',
  kind: 'text',
  options: [],
  showOnCard: true,
  position: 0,
  ...over,
});

describe('displayValue', () => {
  it('formats each kind', () => {
    expect(displayValue(f({}), 'hello', 'en')).toBe('hello');
    expect(displayValue(f({ kind: 'number' }), 1234.5, 'en')).toBe('1,234.5');
    expect(displayValue(f({ kind: 'date' }), '2026-10-04', 'en')).toBe('Oct 4, 2026');
    expect(displayValue(f({ kind: 'checkbox' }), true, 'en')).toBe('✓');
    expect(displayValue(f({ kind: 'checkbox' }), false, 'en')).toBe('');
    expect(displayValue(f({ kind: 'url' }), 'https://www.example.com/a/b', 'en')).toBe(
      'example.com',
    );
    const sel = f({ kind: 'select', options: [{ id: 'a', label: 'High', tone: 'red' }] });
    expect(displayValue(sel, 'a', 'en')).toBe('High');
    expect(displayValue(sel, 'gone', 'en')).toBe('');
  });
  it('is empty when there is no value', () => {
    expect(displayValue(f({}), null, 'en')).toBe('');
    expect(displayValue(f({}), undefined, 'en')).toBe('');
  });
});

describe('chipsFor', () => {
  it('keeps marked fields that hold a value, in field order, with the option tone', () => {
    const fields = [
      f({ id: 'a', name: 'A' }),
      f({ id: 'b', showOnCard: false }),
      f({ id: 'c', kind: 'select', options: [{ id: 'x', label: 'Hot', tone: 'red' }] }),
    ];
    const values = new Map<string, unknown>([
      ['a', 'one'],
      ['b', 'hidden'],
      ['c', 'x'],
    ]);
    expect(chipsFor(fields, values, 'en').map((c) => [c.text, c.tone])).toEqual([
      ['one', 'neutral'],
      ['Hot', 'red'],
    ]);
    expect(chipsFor(fields, undefined, 'en')).toEqual([]);
  });
});
