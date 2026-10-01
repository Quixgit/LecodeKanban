import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectQuery } from '../api/projectsApi';

export type ProjectsView = 'card' | 'list';

export interface ProjectFilters {
  q: string;
  status?: ProjectQuery['status'];
  picId?: string;
  team?: string;
  progress?: ProjectQuery['progress'];
  deadline?: ProjectQuery['deadline'];
  view: ProjectsView;
  page: number;
  showAll: boolean;
}

export const CARD_PAGE_SIZE = 6;
export const LIST_PAGE_SIZE = 10;
export const SHOW_ALL_SIZE = 500;

const filterKeys = ['q', 'status', 'picId', 'team', 'progress', 'deadline'] as const;

/** Filters live in the URL so views are shareable and survive reloads. */
export function useProjectFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<ProjectFilters>(
    () => ({
      q: params.get('q') ?? '',
      status: (params.get('status') ?? undefined) as ProjectFilters['status'],
      picId: params.get('picId') ?? undefined,
      team: params.get('team') ?? undefined,
      progress: (params.get('progress') ?? undefined) as ProjectFilters['progress'],
      deadline: (params.get('deadline') ?? undefined) as ProjectFilters['deadline'],
      view: params.get('view') === 'list' ? 'list' : 'card',
      page: Math.max(1, Number(params.get('page')) || 1),
      showAll: params.get('all') === '1',
    }),
    [params],
  );

  const update = useCallback(
    (
      patch: Partial<
        Record<(typeof filterKeys)[number] | 'view' | 'page' | 'all', string | undefined>
      >,
    ) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, v);
          }
          // Changing a filter returns to the first page.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const clear = useCallback(
    () => update(Object.fromEntries(filterKeys.map((k) => [k, undefined]))),
    [update],
  );
  const active = filterKeys.some((k) => k !== 'q' && filters[k] !== undefined);

  return { filters, update, clear, active };
}

export function toQuery(f: ProjectFilters): ProjectQuery {
  const size = f.showAll ? SHOW_ALL_SIZE : f.view === 'card' ? CARD_PAGE_SIZE : LIST_PAGE_SIZE;
  return {
    q: f.q || undefined,
    status: f.status,
    picId: f.picId,
    team: f.team,
    progress: f.progress,
    deadline: f.deadline,
    sort: 'updated',
    order: 'desc',
    page: f.showAll ? 1 : f.page,
    pageSize: size,
  };
}
