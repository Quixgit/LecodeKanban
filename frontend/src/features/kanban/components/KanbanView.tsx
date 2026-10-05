import {
  FolderPlus,
  Keyboard,
  KanbanSquare,
  MoreHorizontal,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  slugToStatus,
  useCardMutations,
  useLabels,
  type CardInput,
  type Priority,
} from '@/features/cards';
import { ProjectChatButton } from '@/features/chat';
import { useAllProjects } from '@/features/projects';
import { TASK_SEARCH_ID, TasksToolbar, baseQuery, useTaskFilters } from '@/features/tasks-list';
import { BoardFieldsProvider } from '@/features/custom-fields';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useHotkey } from '@/shared/hooks/useHotkey';
import { useShortcutHelp, useShortcutSection } from '@/shared/lib/shortcutHelp';
import {
  Button,
  Card as Panel,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
  Tooltip,
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

interface Props {
  currentUserId: string;
  /** List | Kanban switcher owned by the page. */
  viewSwitch: ReactNode;
  onCreate: () => void;
}

/** Kanban view of the Tasks page: all projects by status, or one project's own board. */
const KANBAN_KEYS = {
  newCard: ['N'],
  search: ['/'],
  navigate: ['↑', '↓', '←', '→'],
  open: ['Enter'],
  drag: ['Space'],
  cancel: ['Esc'],
} as const;

export function KanbanView({ currentUserId, viewSwitch, onCreate }: Props) {
  const { t } = useTranslation(['kanban', 'tasks', 'common']);
  const errorText = useErrorText();
  const [, setParams] = useSearchParams();
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  const canEdit = can(workspace, 'content.edit');
  const { filters, update, clear, activeCount } = useTaskFilters();
  const store = useBoardStore();
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const labels = useLabels(workspace?.id);
  const mode = useMemo<BoardMode>(
    () => (filters.projectId ? { kind: 'project', projectId: filters.projectId } : { kind: 'all' }),
    [filters.projectId],
  );
  // /tasks/<status> (sidebar sub-items) narrows the board to that status.
  const { status: statusSlug } = useParams();
  const only = slugToStatus(statusSlug);
  const query = useMemo(
    () => ({ ...baseQuery(filters), ...(only ? { status: only } : {}) }),
    [filters, only],
  );
  const board = useBoardCards(workspace?.id, query);
  const allColumns = useBoardColumns(mode).columns;
  const columns = useMemo(
    () => (only ? allColumns?.filter((c) => c.status === only) : allColumns),
    [allColumns, only],
  );
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
  const openHelp = useShortcutHelp((st) => st.setOpen);
  useShortcutSection('kanban', {
    title: t('shortcuts.title'),
    items: (['newCard', 'search', 'navigate', 'open', 'drag', 'cancel'] as const).map((a) => ({
      keys: KANBAN_KEYS[a],
      label: t(`shortcuts.${a}`),
    })),
  });

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
      {mode.kind === 'project' && (
        <ProjectChatButton
          projectId={mode.projectId}
          name={projects.data?.items.find((p) => p.id === mode.projectId)?.name ?? ''}
        />
      )}
      <div className="hidden xl:block">
        <Select
          label={t('lane.label')}
          prefix={t('lane.prefix')}
          value={swimlane}
          onValueChange={(v) => store.setSwimlane(v as typeof store.swimlane)}
          options={SWIMLANES.filter((s) => !(mode.kind === 'project' && s === 'project')).map(
            (s) => ({ value: s, label: t(`lane.${s}`) }),
          )}
        />
      </div>
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
      <Tooltip content={`${t('shortcuts.title')} (?)`}>
        <IconButton
          label={t('shortcuts.title')}
          className="hidden xl:inline-flex"
          onClick={() => openHelp(true)}
        >
          <Keyboard />
        </IconButton>
      </Tooltip>
      {/* Below xl the low-priority controls live in one overflow menu. */}
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton label={t('toolbar.more')} className="xl:hidden">
            <MoreHorizontal />
          </IconButton>
        </DropdownTrigger>
        <DropdownContent align="end" className="w-60">
          <DropdownLabel>{t('lane.label')}</DropdownLabel>
          <DropdownRadioGroup
            value={swimlane}
            onValueChange={(v) => store.setSwimlane(v as typeof store.swimlane)}
          >
            {SWIMLANES.filter((l) => !(mode.kind === 'project' && l === 'project')).map((l) => (
              <DropdownRadioItem key={l} value={l}>
                {t(`lane.${l}`)}
              </DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
          <DropdownSeparator />
          <DropdownItem onSelect={() => openHelp(true)}>
            <Keyboard />
            {t('shortcuts.title')}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl bg-surface-column p-2">
              <Skeleton className="h-8 w-40 rounded-full" />
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="h-32 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (board.isError) {
    return (
      <div className="flex flex-col gap-5">
        {toolbar}
        <Panel>
          <EmptyState
            icon={<TriangleAlert />}
            title={t('board.errorTitle')}
            description={errorText(board.error)}
            action={<Button onClick={() => void board.refetch()}>{t('board.retry')}</Button>}
          />
        </Panel>
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
      {cards.length === 0 && activeCount === 0 && !filters.q && (
        <Panel>
          <EmptyState
            icon={<KanbanSquare />}
            title={t('board.emptyTitle')}
            description={t('board.emptyHint')}
            action={
              canEdit ? (
                <Button onClick={onCreate}>
                  <Plus />
                  {t('tasks:add')}
                </Button>
              ) : undefined
            }
          />
        </Panel>
      )}
      <BoardFieldsProvider workspaceId={ws} cardIds={cards.map((c) => c.id)}>
        <Board
          ref={boardRef}
          cards={cards}
          columns={columns}
          lanes={lanes}
          containers={containers}
          swimlane={swimlane}
          collapsed={store.collapsed}
          collapsedLanes={store.collapsedLanes}
          onToggleLane={store.toggleLane}
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
      </BoardFieldsProvider>
      {mode.kind === 'project' && (
        <ColumnManager
          ref={columnsRef}
          projectId={mode.projectId}
          workspaceId={ws}
          columns={columns}
        />
      )}
    </div>
  );
}
