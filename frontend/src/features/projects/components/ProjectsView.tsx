import { motion } from 'framer-motion';
import { Check, FolderPlus, Flag, Loader, Package, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { listContainer } from '@/shared/motion';
import { Button, Card, CountUp, EmptyState, Pagination, Skeleton, StatCard } from '@/shared/ui';
import type { Project } from '../api/projectsApi';
import { useProjectList, useProjectSummary } from '../hooks/useProjects';
import { CARD_PAGE_SIZE, LIST_PAGE_SIZE, toQuery, useProjectFilters } from '../model/filters';
import { ProjectCard } from './ProjectCard';
import { ProjectFormDialog } from './ProjectFormDialog';
import { ProjectsTable } from './ProjectsTable';
import { ProjectsToolbar } from './ProjectsToolbar';

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border border-border-subtle p-5">
          <div className="flex items-center gap-3 pb-4">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-5 py-5">
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-10" />
            ))}
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Projects page: KPIs, filters, card/list views and pagination (screenshot 4). */
export function ProjectsView() {
  const { t } = useTranslation('projects');
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const wsId = workspace?.id;
  const { filters, update, clear, active } = useProjectFilters();
  const summary = useProjectSummary(wsId);
  const list = useProjectList(wsId, toQuery(filters));
  const members = useWorkspaceMembers(wsId);
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);

  const canEdit = can(workspace, 'projects.create');
  const canArchive = can(workspace, 'projects.delete');
  const s = summary.data;
  const kpis = [
    { key: 'total', icon: <Package />, tone: 'plain' as const, value: s?.total },
    { key: 'completed', icon: <Check />, tone: 'teal' as const, value: s?.completed },
    { key: 'inProgress', icon: <Loader />, tone: 'amber' as const, value: s?.inProgress },
    { key: 'pending', icon: <Flag />, tone: 'purple' as const, value: s?.pending },
    { key: 'overdue', icon: <TriangleAlert />, tone: 'red' as const, value: s?.overdue },
  ];
  const pageSize = filters.view === 'card' ? CARD_PAGE_SIZE : LIST_PAGE_SIZE;
  const items = list.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) =>
          s ? (
            <StatCard
              key={k.key}
              icon={k.icon}
              iconTone={k.tone}
              label={t(`kpi.${k.key}`)}
              value={<CountUp value={k.value ?? 0} />}
            />
          ) : (
            <Skeleton key={k.key} className="h-[78px] rounded-xl" />
          ),
        )}
      </div>

      <Card className="flex flex-col gap-5 p-5">
        <ProjectsToolbar
          filters={filters}
          update={update}
          clear={clear}
          active={active}
          members={members.data ?? []}
          teams={s?.teams ?? []}
          canCreate={canEdit}
          onCreate={() => setEditing(null)}
        />

        {list.isPending ? (
          <CardsSkeleton />
        ) : list.error ? (
          <EmptyState title={errorText(list.error)} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<FolderPlus />}
            title={active || filters.q ? t('empty.filtered') : t('empty.title')}
            description={active || filters.q ? undefined : t('empty.description')}
            action={
              active || filters.q ? (
                <Button variant="secondary" onClick={clear}>
                  {t('filters.clear')}
                </Button>
              ) : canEdit ? (
                <Button onClick={() => setEditing(null)}>{t('add')}</Button>
              ) : undefined
            }
          />
        ) : filters.view === 'card' ? (
          <motion.div
            key={`${filters.page}-${filters.showAll}`}
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {items.map((p) => (
              <ProjectCard key={p.id} project={p} canEdit={canEdit} onEdit={setEditing} />
            ))}
          </motion.div>
        ) : (
          <ProjectsTable projects={items} canEdit={canEdit} onEdit={setEditing} />
        )}

        {list.data && list.data.total > 0 && !filters.showAll && (
          <Pagination
            page={filters.page}
            pageSize={pageSize}
            total={list.data.total}
            onPageChange={(page) => update({ page: page > 1 ? String(page) : undefined })}
            onShowAll={list.data.total > pageSize ? () => update({ all: '1' }) : undefined}
          />
        )}
      </Card>

      {wsId && (
        <ProjectFormDialog
          open={editing !== undefined}
          onOpenChange={(o) => !o && setEditing(undefined)}
          workspaceId={wsId}
          members={members.data ?? []}
          teams={s?.teams ?? []}
          project={editing}
          canArchive={canArchive}
        />
      )}
    </div>
  );
}
