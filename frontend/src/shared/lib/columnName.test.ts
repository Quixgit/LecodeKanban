import { describe, expect, it } from 'vitest';
import { columnLabel } from './columnName';

describe('columnLabel', () => {
  it('shows a default column in the reader’s language, whatever language it was stored in', () => {
    expect(columnLabel('До виконання', 'todo', 'To Do')).toBe('To Do');
    expect(columnLabel('To Do', 'todo', 'До виконання')).toBe('До виконання');
    expect(columnLabel('На перевірці', 'in_review', 'In Review')).toBe('In Review');
  });

  it('keeps a name the team chose', () => {
    expect(columnLabel('Backlog', 'todo', 'To Do')).toBe('Backlog');
    // A default name of another status is a custom name here.
    expect(columnLabel('Виконано', 'todo', 'To Do')).toBe('Виконано');
  });
});
