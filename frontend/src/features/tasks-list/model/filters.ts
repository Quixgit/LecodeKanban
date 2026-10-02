import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CardQuery, Priority } from '@/features/cards';

export interface TaskFilters {
  q: string;
  projectId?: string;
  assigneeId?: string;
  priority?: Priority;
  labelId?: string;
  due?: CardQuery['due'];
  page: number;
  showAll: boolean;
}

const keys = ['q', 'projectId', 'assigneeId', 'priority', 'labelId', 'due'] as const;

export function useTaskFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<TaskFilters>(
    () => ({
      q: params.get('q') ?? '',
      projectId: params.get('projectId') ?? undefined,
      assigneeId: params.get('assigneeId') ?? undefined,
      priority: (params.get('priority') ?? undefined) as Priority | undefined,
      labelId: params.get('labelId') ?? undefined,
      due: (params.get('due') ?? undefined) as TaskFilters['due'],
      page: Math.max(1, Number(params.get('page')) || 1),
      showAll: params.get('all') === '1',
    }),
    [params],
  );
  const update = useCallback(
    (patch: Record<string, string | undefined>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, v);
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const clear = useCallback(
    () => update(Object.fromEntries(keys.map((k) => [k, undefined]))),
    [update],
  );
  const activeCount = keys.filter((k) => k !== 'q' && filters[k] !== undefined).length;
  return { filters, update, clear, activeCount };
}

/** Query fields shared by list and count requests. */
export function baseQuery(f: TaskFilters) {
  return {
    q: f.q || undefined,
    projectId: f.projectId,
    assigneeId: f.assigneeId,
    priority: f.priority,
    labelId: f.labelId,
    due: f.due,
  };
}
