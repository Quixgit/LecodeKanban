import type { TaskStatus } from '@/shared/ui/tones';

/**
 * The names the server gives the four default columns, in each language it knows. They are stored when a board is
 * created, so a board made in Ukrainian keeps Ukrainian names for an English reader. Showing those as the status in
 * the reader's own language fixes that; a column the team renamed keeps its own name.
 */
const DEFAULT_NAMES: Record<TaskStatus, readonly string[]> = {
  todo: ['To Do', 'До виконання'],
  in_progress: ['In Progress', 'В роботі'],
  in_review: ['In Review', 'На перевірці'],
  done: ['Completed', 'Виконано'],
};

export const isDefaultColumnName = (name: string, status: TaskStatus) =>
  DEFAULT_NAMES[status].includes(name.trim());

/** The column's name as the reader should see it. `statusLabel` is the current language's name of the status. */
export function columnLabel(name: string, status: TaskStatus, statusLabel: string): string {
  return isDefaultColumnName(name, status) ? statusLabel : name;
}
