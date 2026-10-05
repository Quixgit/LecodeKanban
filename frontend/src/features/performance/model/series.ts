import type { TaskStatus } from '@/features/cards';

/** Chart colours per status: the same CSS variables the dashboard's charts use. */
export const seriesColor: Record<TaskStatus, string> = {
  todo: 'rgb(var(--c-series-todo))',
  in_progress: 'rgb(var(--c-series-progress))',
  in_review: 'rgb(var(--c-series-review))',
  done: 'rgb(var(--c-series-done))',
};

export const seriesBg: Record<TaskStatus, string> = {
  todo: 'bg-series-todo',
  in_progress: 'bg-series-progress',
  in_review: 'bg-series-review',
  done: 'bg-series-done',
};
