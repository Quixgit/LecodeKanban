import type { Priority, ProjectStatus, TaskStatus } from '@/shared/ui';

/** Sample content for the UI kit only (user data, so not translated). */
export interface DemoTask {
  id: string;
  name: string;
  assignee: string;
  project: string;
  progress: number;
  deadline: string;
  priority: Priority;
  status: TaskStatus;
}

export const demoTasks: DemoTask[] = [
  {
    id: 'LK-1254',
    name: 'Migrate server to new infrastructure',
    assignee: 'Michael Ardi',
    project: 'Platform Upgrade',
    progress: 0,
    deadline: '2025-06-10',
    priority: 'medium',
    status: 'todo',
  },
  {
    id: 'LK-2714',
    name: 'Set up new authentication system',
    assignee: 'Lisa Kim',
    project: 'Security Review',
    progress: 0,
    deadline: '2025-06-02',
    priority: 'high',
    status: 'todo',
  },
  {
    id: 'LK-2726',
    name: 'Test API integration with updated modules',
    assignee: 'Lisa Kim',
    project: 'Email Automation',
    progress: 0,
    deadline: '2025-05-31',
    priority: 'low',
    status: 'todo',
  },
  {
    id: 'LK-3561',
    name: 'Instrument checkout with tracing',
    assignee: 'Timmy Tom',
    project: 'Observability',
    progress: 80,
    deadline: '2025-05-25',
    priority: 'medium',
    status: 'in_progress',
  },
  {
    id: 'LK-9712',
    name: 'Refactor board ordering to LexoRank',
    assignee: 'Nina Ross',
    project: 'Kanban Core',
    progress: 55,
    deadline: '2025-05-24',
    priority: 'high',
    status: 'in_progress',
  },
  {
    id: 'LK-5773',
    name: 'Draft onboarding checklist for new hires',
    assignee: 'Amira William',
    project: 'Team Onboarding',
    progress: 90,
    deadline: '2025-05-26',
    priority: 'medium',
    status: 'in_review',
  },
];

export interface DemoProject {
  name: string;
  status: ProjectStatus;
  pic: string;
  team: string;
  role: string;
  done: number;
  total: number;
  deadline: string;
}

export const demoProjects: DemoProject[] = [
  {
    name: 'Onboarding Flow',
    status: 'in_progress',
    pic: 'Jenny Lim',
    team: 'Product',
    role: 'Product Designer',
    done: 5,
    total: 21,
    deadline: '2025-05-24',
  },
  {
    name: 'Security Policy Update',
    status: 'completed',
    pic: 'Michael Ardi',
    team: 'Engineering',
    role: 'Security Officer',
    done: 14,
    total: 14,
    deadline: '2025-05-10',
  },
  {
    name: 'Developer Portal',
    status: 'pending',
    pic: 'Lisa Kim',
    team: 'Platform',
    role: 'Tech Lead',
    done: 1,
    total: 12,
    deadline: '2025-06-25',
  },
];

export const demoPeople = [
  'Peter Gabrielle',
  'Lisa Kim',
  'Michael Ardi',
  'Nina Ross',
  'Leo Gracia',
  'Amira William',
];
