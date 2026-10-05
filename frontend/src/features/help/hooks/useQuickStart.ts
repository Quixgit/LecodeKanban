import { useCardStats } from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { useTwoFactor } from '@/features/profile';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useQuickStartMarks } from '../model/quickStartStore';

export interface QuickStartStep {
  id: 'project' | 'task' | 'invite' | 'twofa' | 'notifications';
  to: string;
  done: boolean;
  /** Done by itself when the platform sees it; otherwise the person ticks it. */
  auto: boolean;
}

/** The new-member checklist: four steps tick themselves from real data, the notifications step is ticked by hand. */
export function useQuickStart(): QuickStartStep[] {
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id;
  const projects = useAllProjects(ws);
  const stats = useCardStats(ws, 7);
  const members = useWorkspaceMembers(ws);
  const twoFactor = useTwoFactor();
  const marked = useQuickStartMarks((s) => s.marked);
  return [
    { id: 'project', to: '/projects', auto: true, done: (projects.data?.total ?? 0) > 0 },
    { id: 'task', to: '/tasks', auto: true, done: (stats.data?.total ?? 0) > 0 },
    { id: 'invite', to: '/team', auto: true, done: (members.data?.length ?? 0) > 1 },
    { id: 'twofa', to: '/profile/security', auto: true, done: twoFactor.data?.enabled === true },
    {
      id: 'notifications',
      to: '/profile/notifications',
      auto: false,
      done: marked.includes('notifications'),
    },
  ];
}
