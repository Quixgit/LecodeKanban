import { FolderPlus, Keyboard } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useCardMutations, useLabels, type CardInput, type Priority } from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { LiveIndicator } from '@/features/realtime';
import { TASK_SEARCH_ID, TasksToolbar, baseQuery, useTaskFilters } from '@/features/tasks-list';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useHotkey } from '@/shared/hooks/useHotkey';
import {
  Button,
  Card as Panel,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
  toast,
} from '@/shared/ui';
import type { DropResult } from '../hooks/useBoardDnd';
import { useBoardCards, useBoardColumns, useBoardMove } from '../hooks/useBoard';
import {
  buildContainers,
  buildLanes,
  columnCounts,
  parseContainer,
  SWIMLANES,
  UNASSIGNED,
  type BoardMode,
} from '../model/board';
import { useBoardStore } from '../model/boardStore';
import { planMove } from '../model/move';
import { Board, type BoardHandle } from './Board';
import { ColumnManager, type ColumnManagerHandle } from './ColumnManager';
import { SavedViewsMenu, type ViewConfig } from './SavedViewsMenu';
import { ShortcutsDialog } from './ShortcutsDialog';

interface Props {
  currentUserId: string;
  /** List | Kanban switcher owned by the page. */
  viewSwitch: ReactNode;
  onCreate: () => void;
}

/** Kanban view of the Tasks page: all projects by status, or one project's own board. */
export function KanbanView({ currentUserId, viewSwitch, onCreate }: Props) {
  const { t } = useTranslation(['kanban', 'tasks', 'common']);
  const errorText = useErrorText();
  const [, setParams] = useSearchParams();
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  const canEdit = !!workspace && workspace.role !== 'viewer';
  const { filters, update, clear, activeCount } = useTaskFilters();
  const store = useBoardStore();
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const labels = useLabels(workspace?.id);
  const mode = useMemo<BoardMode>(
    () => (filters.projectId ? { kind: 'project', projectId: filters.projectId } : { kind: 'all' }),
    [filters.projectId],
  );
  const query = useMemo(() => baseQuery(filters), [filters]);
  const board = useBoardCards(workspace?.id, query);
  const { columns } = useBoardColumns(mode);
  const cards = useMemo(() => board.data?.items ?? [], [board.data]);
  const swimlane =
    mode.kind === 'project' && store.swimlane === 'project' ? 'none' : store.swimlane;

  const people = useMemo(
    () =>
      Object.fromEntries(
        (members.data ?? []).map((m) => [
          m.user.id,
          { id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl },
        ]),
      ),
    [members.data],
  );
  const lanes = useMemo(
    () => buildLanes(cards, swimlane, t('lane.unassigned')),
    [cards, swimlane, t],
  );
  const containers = useMemo(
    () => (columns ? buildContainers(cards, columns, lanes, mode, swimlane) : {}),
    [cards, columns, lanes, mode, swimlane],
  );
  const move = useBoardMove(ws, query, people);
  const create = useCardMutations(ws).create;
  const boardRef = useRef<BoardHandle>(null);
  const columnsRef = useRef<ColumnManagerHandle>(null);
  const [shortcuts, setShortcuts] = useState(false);

  const openCard = useCallback(
    (id: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('card', id);
        return next;
      }),
    [setParams],
  );

  const onDrop = useCallback(
    (r: DropResult) => {
      const card = cards.find((c) => c.id === r.cardId);
      if (!card || !columns) return;
      const plan = planMove({
        card,
        mode,
        swimlane,
        columns,
        fromContainer: r.from,
        toContainer: r.to,
        targetIds: r.targetIds,
        originalIds: r.originalIds,
      });
      if (!plan) return;
      const target = columns.find((c) => c.key === parseContainer(r.to).column);
      const sameColumn = parseContainer(r.from).column === parseContainer(r.to).column;
      const count = columnCounts(containers)[target?.key ?? ''] ?? 0;
      if (target?.wipLimit != null && !sameColumn && count + 1 > target.wipLimit) {
        toast.info(t('wip.exceeded', { column: target.name, limit: target.wipLimit }));
      }
      move.mutate(plan, { onError: (e) => toast.error(errorText(e)) });
    },
    [cards, columns, containers, mode, swimlane, move, errorText, t],
  );

  const projectOptions = (projects.data?.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
  }));
  const quickAddProject =
    mode.kind === 'project' ? mode.projectId : (store.quickAddProjectId ?? projectOptions[0]?.id);

  const quickCreate = (container: string, title: string) => {
    const { lane, column } = parseContainer(container);
    const col = columns?.find((c) => c.key === column);
    const projectId = swimlane === 'project' ? lane : quickAddProject;
    if (!col || !projectId) return Promise.reject(new Error('no project'));
    const body: CardInput = {
      projectId,
      title,
      ...(col.columnId ? { columnId: col.columnId } : { status: col.status }),
    };
    if (swimlane === 'priority') body.priority = lane as Priority;
    if (swimlane === 'assignee' && lane !== UNASSIGNED) body.assigneeIds = [lane];
    return create.mutateAsync(body, { onError: (e) => toast.error(errorText(e)) });
  };

  useHotkey(
    'n',
    () => {
      const focused = document.activeElement?.closest<HTMLElement>('[data-container]');
      boardRef.current?.openQuickAdd(focused?.dataset.container);
    },
    { enabled: canEdit },
  );
  useHotkey('/', () => document.getElementById(TASK_SEARCH_ID)?.focus());
  useHotkey('?', () => setShortcuts(true), { shift: true });

  const current: ViewConfig = {
    swimlane: store.swimlane,
    filters: {
      q: filters.q || undefined,
      projectId: filters.projectId,
      assigneeId: filters.assigneeId,
      priority: filters.priority,
      labelId: filters.labelId,
      due: filters.due,
    },
  };

  const controls = (
    <>
      <LiveIndicator className="hidden lg:inline-flex" />
      <Select
        label={t('lane.label')}
        prefix={t('lane.prefix')}
        value={swimlane}
        onValueChange={(v) => store.setSwimlane(v as typeof store.swimlane)}
        options={SWIMLANES.filter((s) => !(mode.kind === 'project' && s === 'project')).map(
          (s) => ({ value: s, label: t(`lane.${s}`) }),
        )}
      />
      {ws && (
        <SavedViewsMenu
          workspaceId={ws}
          current={current}
          onApply={(cfg) => {
            update({
              q: undefined,
              projectId: undefined,
              assigneeId: undefined,
              priority: undefined,
              labelId: undefined,
              due: undefined,
              ...cfg.filters,
            });
            store.setSwimlane(cfg.swimlane);
          }}
        />
      )}
      <IconButton label={t('shortcuts.title')} onClick={() => setShortcuts(true)}>
        <Keyboard />
      </IconButton>
      {viewSwitch}
    </>
  );

  const toolbar = (
    <Panel className="p-4">
      <TasksToolbar
        filters={filters}
        update={update}
        clear={clear}
        activeCount={activeCount}
        projects={projectOptions}
        members={members.data ?? []}
        labels={labels.data}
        currentUserId={currentUserId}
        canCreate={canEdit}
        onCreate={onCreate}
        extra={controls}
      />
    </Panel>
  );

  if (!workspace || projects.isPending || board.isPending || !columns) {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        {toolbar}
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex w-[296px] shrink-0 flex-col gap-2.5">
              <Skeleton className="h-8 w-40 rounded-lg" />
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-32 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (projectOptions.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<FolderPlus />}
          title={t('tasks:empty.noProjects')}
          action={
            <Button asChild>
              <Link to="/projects">{t('tasks:empty.createProject')}</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {toolbar}
      {board.data?.truncated && (
        <p
          role="status"
          className="rounded-lg bg-progress-soft px-4 py-2 text-sm text-progress-ink"
        >
          {t('board.truncated')}
        </p>
      )}
      <Board
        ref={boardRef}
        cards={cards}
        columns={columns}
        lanes={lanes}
        containers={containers}
        swimlane={swimlane}
        collapsed={store.collapsed}
        canEdit={canEdit}
        canManageColumns={canEdit && mode.kind === 'project'}
        onToggleColumn={store.toggleColumn}
        onColumnAction={(col, a) => columnsRef.current?.act(col, a)}
        onAddColumn={() => columnsRef.current?.add()}
        onOpen={openCard}
        onDrop={onDrop}
        quickAdd={{
          busy: create.isPending,
          projects: mode.kind === 'all' && swimlane !== 'project' ? projectOptions : undefined,
          projectId: quickAddProject,
          onProjectChange: store.setQuickAddProject,
          onCreate: quickCreate,
        }}
      />
      {mode.kind === 'project' && (
        <ColumnManager
          ref={columnsRef}
          projectId={mode.projectId}
          workspaceId={ws}
          columns={columns}
        />
      )}
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </div>
  );
}
