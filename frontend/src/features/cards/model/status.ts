import type { Priority, TaskStatus } from '../api/cardsApi';

export const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

/** URL slugs used by the sidebar (/tasks/in-progress …). */
const slugs: Record<TaskStatus, string> = {
  todo: 'todo',
  in_progress: 'in-progress',
  in_review: 'in-review',
  done: 'completed',
};

export function statusToSlug(s: TaskStatus): string {
  return slugs[s];
}

export function slugToStatus(slug: string | undefined): TaskStatus | undefined {
  return (Object.keys(slugs) as TaskStatus[]).find((s) => slugs[s] === slug);
}
