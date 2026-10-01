import type { ProjectStatus as PillStatus, Tone } from '@/shared/ui';
import type { Project } from '../api/projectsApi';

/** Display status: an unfinished project past its deadline shows as overdue. */
export function displayStatus(p: Pick<Project, 'status' | 'overdue'>): PillStatus {
  if (p.overdue) return 'overdue';
  return p.status;
}

/** Progress bar tone: purple while pending, teal when complete, amber otherwise, red when overdue. */
export function progressTone(p: Pick<Project, 'status' | 'overdue' | 'progress'>): Tone {
  if (p.progress >= 100) return 'teal';
  if (p.overdue) return 'red';
  return p.status === 'pending' ? 'purple' : 'amber';
}
