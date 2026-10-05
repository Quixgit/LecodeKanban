import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardStats } from '@/features/cards';
import { useProjectList } from '@/features/projects';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Card, CountUp, EmptyState, MetricCard, Skeleton } from '@/shared/ui';
import { ActivityFeed } from './ActivityFeed';
import { RecentProjects } from './RecentProjects';
import { StatusBars } from './StatusBars';
import { ThroughputChart } from './ThroughputChart';

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2" aria-busy>
      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

/** Dashboard: KPIs with trends, throughput, recent activity, recent projects, tasks by status. */
export function DashboardView() {
  const { t } = useTranslation('dashboard');
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const [days, setDays] = useState(7);
  const stats = useCardStats(workspace?.id, days);
  const projects = useProjectList(workspace?.id, { sort: 'updated', order: 'desc', pageSize: 3 });

  if (stats.isPending || projects.isPending) return <DashboardSkeleton />;
  if (stats.error) {
    return (
      <Card>
        <EmptyState title={errorText(stats.error)} />
      </Card>
    );
  }
  const s = stats.data;
  const label = t('kpi.vsLastWeek', { days });
  const period = t('kpi.period', { days });
  const created = s.daily.map((d) => d.todo);
  const done = s.daily.map((d) => d.done);
  const net = created.reduce((a, n, i) => a + n - done[i]!, 0);
  const before = s.active - net;
  let run = 0;
  const backlog = s.daily.map((d) => (run += d.todo - d.done));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            title={t('kpi.active')}
            value={<CountUp value={s.active} />}
            total={s.total}
            trend={before > 0 ? (net / before) * 100 : null}
            delta={net}
            trendLabel={label}
            spark={backlog}
            inverse
            caption={`${s.inReview} ${t('kpi.inReview')}`}
          />
          <MetricCard
            title={`${t('kpi.completed')} · ${period}`}
            value={<CountUp value={s.completedThisWeek.value} />}
            trend={s.completedThisWeek.changePct}
            trendLabel={label}
            delta={s.completedThisWeek.value - s.completedThisWeek.previous}
            spark={done}
          />
          <MetricCard
            title={`${t('kpi.created')} · ${period}`}
            value={<CountUp value={s.createdThisWeek.value} />}
            trend={s.createdThisWeek.changePct}
            trendLabel={label}
            delta={s.createdThisWeek.value - s.createdThisWeek.previous}
            spark={created}
          />
          <MetricCard
            title={t('kpi.overdue')}
            value={<CountUp value={s.overdue} />}
            caption={t('kpi.open', { total: s.active })}
          />
        </div>
        <ActivityFeed items={s.activity} />
      </div>
      <div className="flex flex-col gap-6">
        <ThroughputChart daily={s.daily} days={days} onDaysChange={setDays} />
        <RecentProjects projects={projects.data?.items ?? []} />
        <StatusBars counts={s.statusCounts} />
      </div>
    </div>
  );
}
