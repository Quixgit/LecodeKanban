import type { SortingState } from '@tanstack/react-table';

export type SortKey =
  'key' | 'title' | 'assignee' | 'project' | 'progress' | 'deadline' | 'priority';

/** Maps table sorting state to API sort params. */
export function toSortParams(s: SortingState): { sort?: SortKey; order?: 'asc' | 'desc' } {
  const first = s[0];
  if (!first) return {};
  return { sort: first.id as SortKey, order: first.desc ? 'desc' : 'asc' };
}
