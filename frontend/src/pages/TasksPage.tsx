import { CalendarDays, Columns3, List } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { CalendarView } from '@/features/calendar';
import { CardDrawer } from '@/features/card-drawer';
import { CardFormDialog } from '@/features/cards';
import { KanbanView, useBoardStore, type TasksView } from '@/features/kanban';
import { useAllProjects } from '@/features/projects';
import { TasksListView, useTaskFilters } from '@/features/tasks-list';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { SegmentedControl } from '@/shared/ui';

export default function TasksPage() {
  const { t } = useTranslation('tasks');
  const { user } = useSession();
  const { view, setView } = useBoardStore();
  const { workspace } = useCurrentWorkspace();
  const { filters } = useTaskFilters();
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  /** Open "new task" dialog; `day` pre-fills the due date (calendar). */
  const [creating, setCreating] = useState<{ day?: string } | null>(null);
  if (!user) return null;

  const viewSwitch = (
    <SegmentedControl<TasksView>
      label={t('views.label')}
      value={view}
      onChange={setView}
      options={[
        {
          value: 'list',
          label: <span className="sr-only 2xl:not-sr-only">{t('views.list')}</span>,
          icon: <List />,
        },
        {
          value: 'kanban',
          label: <span className="sr-only 2xl:not-sr-only">{t('views.kanban')}</span>,
          icon: <Columns3 />,
        },
        {
          value: 'calendar',
          label: <span className="sr-only 2xl:not-sr-only">{t('views.calendar')}</span>,
          icon: <CalendarDays />,
        },
      ]}
    />
  );

  return (
    <>
      {view === 'kanban' ? (
        <KanbanView
          currentUserId={user.id}
          viewSwitch={viewSwitch}
          onCreate={() => setCreating({})}
        />
      ) : view === 'calendar' ? (
        <CalendarView
          currentUserId={user.id}
          viewSwitch={viewSwitch}
          onCreate={(day) => setCreating({ day })}
        />
      ) : (
        <TasksListView currentUserId={user.id} viewSwitch={viewSwitch} />
      )}
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
