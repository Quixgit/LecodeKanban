import { Check, Flag, Loader, Package, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { formatPercent } from '@/shared/lib/format';
import {
  Avatar,
  AvatarGroup,
  CountUp,
  IconButton,
  MetricCard,
  Pill,
  PriorityPill,
  ProgressBar,
  ProjectStatusPill,
  StatCard,
  StatusTag,
  TaskStatusPill,
  TrendChip,
} from '@/shared/ui';
import { demoPeople } from '../model/demoData';
import { Row, ShowcaseSection } from './ShowcaseSection';

export function DataDisplaySection() {
  const { t } = useTranslation('showcase');
  const { language } = useLanguage();
  const pct = (v: number) => formatPercent(v, language, 2);

  return (
    <ShowcaseSection id="data" title={t('data.title')} description={t('data.description')}>
      <Row label={t('data.priority')}>
        <PriorityPill priority="high" />
        <PriorityPill priority="medium" />
        <PriorityPill priority="low" />
      </Row>
      <Row label={t('data.taskStatus')}>
        <TaskStatusPill status="todo" />
        <TaskStatusPill status="in_progress" />
        <TaskStatusPill status="in_review" />
        <TaskStatusPill status="done" />
        <Pill tone="teal" icon={<Check />}>
          {t('data.paid')}
        </Pill>
      </Row>
      <Row label={t('data.projectStatus')}>
        <ProjectStatusPill status="in_progress" />
        <ProjectStatusPill status="completed" />
        <ProjectStatusPill status="pending" />
        <ProjectStatusPill status="overdue" />
      </Row>
      <Row label={t('data.groupTags')}>
        {(['todo', 'in_progress', 'in_review', 'done'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <StatusTag status={s} />
            <span className="tabular flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-md text-text-secondary">
              {[18, 32, 24, 48][i]}
            </span>
          </div>
        ))}
      </Row>
      <Row label={t('data.avatars')}>
        <Avatar name="Peter Gabrielle" size="xs" />
        <Avatar name="Lisa Kim" size="sm" />
        <Avatar name="Michael Ardi" size="md" />
        <Avatar name="Nina Ross" size="lg" />
        <Avatar name="Leo Gracia" size="xl" />
        <AvatarGroup people={demoPeople.map((name) => ({ name }))} total={45} size="sm" />
      </Row>
      <Row label={t('data.progress')}>
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <ProgressBar value={42} label="42%" />
          <ProgressBar value={100} label="100%" />
          <ProgressBar value={10} tone="purple" label="10%" />
        </div>
      </Row>
      <Row label={t('data.trends')}>
        <TrendChip value={1.5} format={(v) => pct(v)} />
        <TrendChip value={-10.5} format={(v) => pct(v)} />
      </Row>
      <Row label={t('data.kpis')}>
        <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={<Package />} label={t('data.kpi.total')} value={<CountUp value={42} />} />
          <StatCard
            icon={<Check />}
            iconTone="teal"
            label={t('data.kpi.completed')}
            value={<CountUp value={20} />}
          />
          <StatCard
            icon={<Loader />}
            iconTone="amber"
            label={t('data.kpi.inProgress')}
            value={<CountUp value={14} />}
          />
          <StatCard
            icon={<Flag />}
            iconTone="purple"
            label={t('data.kpi.pending')}
            value={<CountUp value={8} />}
          />
          <StatCard
            icon={<TriangleAlert />}
            iconTone="red"
            label={t('data.kpi.overdue')}
            value={<CountUp value={2} />}
          />
        </div>
      </Row>
      <Row label={t('data.metrics')}>
        <div className="grid w-full gap-4 md:grid-cols-2">
          <MetricCard
            title={t('data.metric.activeTasks')}
            value={<CountUp value={81} />}
            total={96}
            trend={1.5}
            trendLabel={t('data.metric.vsYesterday')}
            menu={
              <IconButton label={t('controls.more')} size="sm">
                <span className="text-base leading-none">•••</span>
              </IconButton>
            }
          />
          <MetricCard
            title={t('data.metric.openBugs')}
            value={<CountUp value={135} />}
            trend={-10.5}
            trendLabel={t('data.metric.vsYesterday')}
          />
        </div>
      </Row>
    </ShowcaseSection>
  );
}
