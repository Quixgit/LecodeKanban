import { useState } from 'react';
import { useSession } from '@/features/auth';
import { CalendarView } from '@/features/calendar';
import { CardDrawer } from '@/features/card-drawer';
import { CardFormDialog } from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { useTaskFilters } from '@/features/tasks-list';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';

/** Full-page calendar: the Tasks calendar view without the view switcher. */
export default function CalendarPage() {
  const { user } = useSession();
  const { workspace } = useCurrentWorkspace();
  const { filters } = useTaskFilters();
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const [creating, setCreating] = useState<{ day?: string } | null>(null);
  if (!user) return null;

  return (
    <>
      <CalendarView currentUserId={user.id} onCreate={(day) => setCreating({ day })} />
      {creating && workspace && (
        <CardFormDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          workspaceId={workspace.id}
          projects={(projects.data?.items ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            key: p.key,
          }))}
          members={members.data ?? []}
          card={null}
          initial={{ projectId: filters.projectId, dueDate: creating.day }}
        />
      )}
      <CardDrawer currentUserId={user.id} />
    </>
  );
}
