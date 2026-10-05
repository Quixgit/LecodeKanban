import type { RecurringTask, RecurringTaskInput, TaskTemplate } from '../api/templatesApi';

export type Freq = RecurringTask['freq'];

/** 1 = Monday … 7 = Sunday, the order the server uses. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export interface RecurringDraft {
  templateId: string;
  projectId: string;
  freq: Freq;
  weekdays: number[];
  monthDay: number;
  hour: number;
  timezone: string;
  active: boolean;
}

export function emptyRecurring(timezone: string): RecurringDraft {
  return {
    templateId: '',
    projectId: '',
    freq: 'weekly',
    weekdays: [1],
    monthDay: 1,
    hour: 9,
    timezone,
    active: true,
  };
}

export function draftFrom(r: RecurringTask): RecurringDraft {
  return {
    templateId: r.templateId,
    projectId: r.projectId,
    freq: r.freq,
    weekdays: r.weekdays.length > 0 ? [...r.weekdays] : [1],
    monthDay: r.monthDay ?? 1,
    hour: r.hour,
    timezone: r.timezone,
    active: r.active,
  };
}

/** The request body for a draft; only the fields that belong to the chosen frequency are sent. */
export function toInput(d: RecurringDraft): RecurringTaskInput {
  return {
    templateId: d.templateId,
    projectId: d.projectId,
    freq: d.freq,
    weekdays: d.freq === 'weekly' ? [...d.weekdays].sort((a, b) => a - b) : [],
    monthDay: d.freq === 'monthly' ? d.monthDay : undefined,
    hour: d.hour,
    timezone: d.timezone || 'UTC',
    active: d.active,
  };
}

/** Why a draft cannot be saved yet, as a key under `recurring.errors`; null when it is fine. */
export function draftError(d: RecurringDraft): 'template' | 'project' | 'weekdays' | null {
  if (!d.templateId) return 'template';
  if (!d.projectId) return 'project';
  if (d.freq === 'weekly' && d.weekdays.length === 0) return 'weekdays';
  return null;
}

export function toggleWeekday(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** One line per entry in a textarea → the list the server stores (blank lines dropped, trimmed, capped). */
export function parseLines(text: string, max = 100): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max);
}

export const linesText = (lines: string[]): string => lines.join('\n');

export interface TemplateDraft {
  name: string;
  title: string;
  description: string;
  priority: TaskTemplate['priority'];
  checklist: string;
  subtasks: string;
  dueInDays: string;
}

export const emptyTemplate: TemplateDraft = {
  name: '',
  title: '',
  description: '',
  priority: 'medium',
  checklist: '',
  subtasks: '',
  dueInDays: '',
};

export function templateDraft(t: TaskTemplate): TemplateDraft {
  return {
    name: t.name,
    title: t.title,
    description: t.description,
    priority: t.priority,
    checklist: linesText(t.checklist),
    subtasks: linesText(t.subtasks),
    dueInDays: t.dueInDays === null ? '' : String(t.dueInDays),
  };
}

/** A whole number of days from 0 to 365, or empty for "no due date"; null when it is neither. */
export function parseDueDays(text: string): number | null | undefined {
  const s = text.trim();
  if (s === '') return null;
  if (!/^\d{1,3}$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 0 && n <= 365 ? n : undefined;
}
