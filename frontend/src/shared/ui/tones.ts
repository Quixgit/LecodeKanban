/** Semantic colour tones shared by pills, tags, progress bars and icons. */
export type Tone = 'neutral' | 'teal' | 'amber' | 'purple' | 'red';

export const toneClasses: Record<
  Tone,
  { soft: string; ink: string; fill: string; bar: string; track: string }
> = {
  neutral: {
    soft: 'bg-todo-soft',
    ink: 'text-todo-ink',
    fill: 'bg-todo',
    bar: 'bg-todo',
    track: 'bg-todo-soft',
  },
  teal: {
    soft: 'bg-done-soft',
    ink: 'text-done-ink',
    fill: 'bg-done',
    bar: 'bg-done',
    track: 'bg-done-soft',
  },
  amber: {
    soft: 'bg-progress-soft',
    ink: 'text-progress-ink',
    fill: 'bg-progress',
    bar: 'bg-progress-bar',
    track: 'bg-progress-soft',
  },
  purple: {
    soft: 'bg-review-soft',
    ink: 'text-review-ink',
    fill: 'bg-review',
    bar: 'bg-review-bar',
    track: 'bg-review-soft',
  },
  red: {
    soft: 'bg-danger-soft',
    ink: 'text-danger-ink',
    fill: 'bg-danger',
    bar: 'bg-danger',
    track: 'bg-danger-soft',
  },
};

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type ProjectStatus = 'in_progress' | 'completed' | 'pending' | 'overdue';

export const statusTone: Record<TaskStatus, Tone> = {
  todo: 'neutral',
  in_progress: 'amber',
  in_review: 'purple',
  done: 'teal',
};

export const priorityTone: Record<Priority, Tone> = { high: 'red', medium: 'teal', low: 'purple' };

export const projectStatusTone: Record<ProjectStatus, Tone> = {
  in_progress: 'amber',
  completed: 'teal',
  pending: 'purple',
  overdue: 'red',
};

/** Progress bar tone in project cards: amber while running, teal when done. */
export function progressTone(percent: number): Tone {
  return percent >= 100 ? 'teal' : 'amber';
}
