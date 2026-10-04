import type { RowSelectionState, SortingState } from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  CardFormDialog,
  STATUSES,
  slugToStatus,
  useCardCounts,
  useCardList,
  useCardMutations,
  type Card,
  type Priority,
  type TaskStatus,
} from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { listContainer } from '@/shared/motion';
import {
  Button,
  Card as Panel,
  ConfirmDialog,
  EmptyState,
  Pagination,
  Skeleton,
  toast,
} from '@/shared/ui';
import { baseQuery, useTaskFilters, type TaskFilters } from '../model/filters';
import { useGroupsStore } from '../model/groupsStore';
import { BulkBar } from './BulkBar';
import { StatusGroup } from './StatusGroup';
import { TasksToolbar } from './TasksToolbar';
import { toSortParams } from '../model/sorting';

const PREVIEW_SIZE = 5;
const PAGE_SIZE = 20;
const SHOW_ALL = 500;
const VIRTUAL_THRESHOLD = 60;

interface GroupProps {
  workspaceId: string;
  status: TaskStatus;
  filters: TaskFilters;
  single: boolean;
  count: number | undefined;
  selection: RowSelectionState;
  onSelection: (s: TaskStatus, sel: RowSelectionState) => void;
  canEdit: boolean;
  onEdit: (c: Card) => void;
  onOpen: (c: Card) => void;
  onMove: (c: Card, s: TaskStatus) => void;
  onDelete: (c: Card) => void;
  onPage: (page: number) => void;
  onShowAll: () => void;
}

function Group(p: GroupProps) {
  const location = useLocation();
  const collapsed = useGroupsStore((s) => s.collapsed.includes(p.status));
  const toggle = useGroupsStore((s) => s.toggle);
  const [sorting, setSorting] = useState<SortingState>([]);
  const size = p.single ? (p.filters.showAll ? SHOW_ALL : PAGE_SIZE) : PREVIEW_SIZE;
  const page = p.single && !p.filters.showAll ? p.filters.page : 1;
  const list = useCardList(
    p.workspaceId,
    { ...baseQuery(p.filters), status: p.status, ...toSortParams(sorting), page, pageSize: size },
    p.single || !collapsed,
  );
  const cards = useMemo(() => list.data?.items ?? [], [list.data]);

  return (
    <StatusGroup
      status={p.status}
      count={p.count}
      cards={cards}
      loading={list.isPending}
      collapsed={!p.single && collapsed}
      onToggle={() => toggle(p.status)}
      sorting={sorting}
      onSortingChange={setSorting}
      selection={p.selection}
      onSelectionChange={(sel) => p.onSelection(p.status, sel)}
      canEdit={p.canEdit}
      onEdit={p.onEdit}
      onOpen={p.onOpen}
      onMove={p.onMove}
      onDelete={p.onDelete}
      showViewAll={!p.single}
      search={location.search}
      virtual={p.single && cards.length > VIRTUAL_THRESHOLD}
      footer={
        p.single && list.data && list.data.total > 0 && !p.filters.showAll ? (
          <Pagination
            className="mt-4"
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPageChange={p.onPage}
            onShowAll={list.data.total > PAGE_SIZE ? p.onShowAll : undefined}
          />
        ) : undefined
      }
    />
  );
}

/** Tasks list: grouped by status (overview) or a single status (from the sidebar / View All). */
export function TasksListView({
  currentUserId,
  viewSwitch,
}: {
  currentUserId: string;
  viewSwitch?: ReactNode;
}) {
  const { t } = useTranslation(['tasks', 'common']);
  const errorText = useErrorText();
  const { status: slug } = useParams();
  const single = slugToStatus(slug);
  const { workspace } = useCurrentWorkspace();
  const wsId = workspace?.id;
  const canEdit = can(workspace, 'content.edit');
  const { filters, update, clear, activeCount } = useTaskFilters();
  const counts = useCardCounts(wsId, baseQuery(filters));
  const projects = useAllProjects(wsId);
  const members = useWorkspaceMembers(wsId);
  const mutations = useCardMutations(wsId ?? '');

  const [selection, setSelection] = useState<Partial<Record<TaskStatus, RowSelectionState>>>({});
  const [form, setForm] = useState<{ card: Card | null } | null>(null);
  const [deleting, setDeleting] = useState<Card | null>(null);
  const location = useLocation();
  const [, setParams] = useSearchParams();
  const openCard = (c: Card) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('card', c.id);
      return next;
    });
  const backSearch = useMemo(() => {
    const q = new URLSearchParams(location.search);
    q.delete('page');
    q.delete('all');
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [location.search]);

  const selectedIds = Object.values(selection).flatMap((sel) =>
    Object.keys(sel ?? {}).filter((id) => sel?.[id]),
  );
  const clearSelection = () => setSelection({});
  const projectOptions = (projects.data?.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
  }));
  const statuses = single ? [single] : STATUSES;

  const onMove = (card: Card, status: TaskStatus) =>
    mutations.move.mutate(
      { card, move: { status } },
      {
        onSuccess: (c) =>
          toast.success(t('toast.moved', { key: c.key, status: t(`common:status.${status}`) })),
        onError: (e) => toast.error(errorText(e)),
      },
    );

  const bulk = (
    action: 'move' | 'priority' | 'delete',
    extra: { status?: TaskStatus; priority?: Priority } = {},
  ) =>
    mutations.bulk.mutate(
      { ids: selectedIds, action, ...extra },
      {
        onSuccess: (r) => {
          toast.success(
            action === 'delete'
              ? t('bulk.deleted', { count: r.updated })
              : t('bulk.done', { count: r.updated }),
          );
          clearSelection();
        },
        onError: (e) => toast.error(errorText(e)),
      },
    );

  if (!wsId || projects.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        <Skeleton className="h-16 rounded-2xl" />
        {STATUSES.map((s) => (
          <Skeleton key={s} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (projectOptions.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<FolderPlus />}
          title={t('empty.noProjects')}
          action={
            <Button asChild>
              <Link to="/projects">{t('empty.createProject')}</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel className="p-4">
        <TasksToolbar
          filters={filters}
          update={update}
          clear={clear}
          activeCount={activeCount}
          projects={projectOptions}
          members={members.data ?? []}
          currentUserId={currentUserId}
          canCreate={canEdit}
          onCreate={() => setForm({ card: null })}
          extra={viewSwitch}
        />
      </Panel>

      {single && (
        <Link
          to={`/tasks${backSearch}`}
          className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-text"
        >
          <ArrowLeft className="size-4" />
          {t('backToAll')}
        </Link>
      )}

      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5"
      >
        {statuses.map((s) => (
          <Group
            key={s}
            workspaceId={wsId}
            status={s}
            filters={filters}
            single={!!single}
            count={counts.data?.[s]}
            selection={selection[s] ?? {}}
            onSelection={(st, sel) => setSelection((prev) => ({ ...prev, [st]: sel }))}
            canEdit={canEdit}
            onEdit={(c) => setForm({ card: c })}
            onOpen={openCard}
            onMove={onMove}
            onDelete={setDeleting}
            onPage={(page) => update({ page: page > 1 ? String(page) : undefined })}
            onShowAll={() => update({ all: '1' })}
          />
        ))}
      </motion.div>

      {canEdit && (
        <BulkBar
          count={selectedIds.length}
          busy={mutations.bulk.isPending}
          onMove={(status) => bulk('move', { status })}
          onPriority={(priority) => bulk('priority', { priority })}
          onDelete={() => bulk('delete')}
          onClear={clearSelection}
        />
      )}

      {form && (
        <CardFormDialog
          open
          onOpenChange={(o) => !o && setForm(null)}
          workspaceId={wsId}
          projects={projectOptions}
          members={members.data ?? []}
          card={form.card}
          initial={{ projectId: filters.projectId, status: single }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('confirmDelete.title', { key: deleting?.key })}
        description={t('confirmDelete.body')}
        confirmLabel={t('confirmDelete.confirm')}
        loading={mutations.remove.isPending}
        onConfirm={() =>
          deleting &&
          mutations.remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.info(t('toast.deleted', { key: deleting.key }));
              setDeleting(null);
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </div>
  );
}
