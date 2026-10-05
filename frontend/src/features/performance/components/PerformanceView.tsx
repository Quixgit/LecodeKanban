import { Download, FilterX, Gauge } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabels } from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Card, EmptyState, FilterSelect, Reveal, SegmentedControl, Skeleton } from '@/shared/ui';
import { buttonVariants } from '@/shared/ui/buttonVariants';
import type { PerformanceQuery } from '../api/performanceApi';
import { usePerformance } from '../hooks/usePerformance';
import { CycleCard } from './CycleCard';
import { FlowCard } from './FlowCard';
import { KpiStrip } from './KpiStrip';
import { ProjectsCard } from './ProjectsCard';
import { ThroughputCard } from './ThroughputCard';
import { WorkloadCard } from './WorkloadCard';

type Period = '7' | '30' | '90';

function PerformanceSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Team performance for the person who runs the team: flow and load, never a verdict on one task. */
export function PerformanceView() {
  const { t } = useTranslation('performance');
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const allowed = can(workspace, 'analytics.view');
  const [period, setPeriod] = useState<Period>('30');
  const [projectId, setProjectId] = useState<string>();
  const [assigneeId, setAssigneeId] = useState<string>();
  const [labelId, setLabelId] = useState<string>();
  const query: PerformanceQuery = {
    days: Number(period) as PerformanceQuery['days'],
    projectId,
    assigneeId,
    labelId,
  };
  const report = usePerformance(allowed ? workspace?.id : undefined, query);
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const labels = useLabels(workspace?.id);

  if (!workspace) return <PerformanceSkeleton />;
  if (!allowed) {
    return (
      <Card>
        <EmptyState icon={<Gauge />} title={t('noAccess')} />
      </Card>
    );
  }
  const filtered = !!(projectId || assigneeId || labelId);
  const csv = new URLSearchParams(
    Object.entries({ projectId, assigneeId, labelId }).filter((e): e is [string, string] => !!e[1]),
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Period>
          label={t('period.label')}
          value={period}
          onChange={setPeriod}
          options={(['7', '30', '90'] as const).map((d) => ({ value: d, label: t(`period.${d}`) }))}
        />
        <FilterSelect
          label={t('filters.project')}
          placeholder={t('filters.project')}
          anyLabel={t('filters.allProjects')}
          value={projectId}
          onChange={setProjectId}
          options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterSelect
          label={t('filters.person')}
          placeholder={t('filters.person')}
          anyLabel={t('filters.everyone')}
          value={assigneeId}
          onChange={setAssigneeId}
          options={(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.name }))}
        />
        <FilterSelect
          label={t('filters.label')}
          placeholder={t('filters.label')}
          anyLabel={t('filters.anyLabel')}
          value={labelId}
          onChange={setLabelId}
          options={(labels.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
        />
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setProjectId(undefined);
              setAssigneeId(undefined);
              setLabelId(undefined);
            }}
            className="inline-flex h-control items-center gap-1.5 rounded-lg px-2.5 text-sm text-text-secondary hover:bg-surface-sunken hover:text-text"
          >
            <FilterX className="size-4" aria-hidden />
            {t('filters.clear')}
          </button>
        )}
        {can(workspace, 'data.export') && (
          <a
            href={`/api/v1/workspaces/${workspace.id}/export/tasks.csv${csv ? `?${csv}` : ''}`}
            download
            className={`${buttonVariants({ variant: 'secondary' })} ml-auto`}
          >
            <Download />
            {t('download')}
          </a>
        )}
      </div>

      {report.isPending ? (
        <PerformanceSkeleton />
      ) : report.error ? (
        <Card>
          <EmptyState title={errorText(report.error)} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <KpiStrip report={report.data} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Reveal index={5}>
              <ThroughputCard report={report.data} />
            </Reveal>
            <Reveal index={6}>
              <FlowCard report={report.data} />
            </Reveal>
            <Reveal index={7}>
              <CycleCard report={report.data} />
            </Reveal>
            <div className="flex flex-col gap-6">
              <Reveal index={8}>
                <WorkloadCard report={report.data} />
              </Reveal>
              <Reveal index={9}>
                <ProjectsCard report={report.data} />
              </Reveal>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
