import { useTranslation } from 'react-i18next';
import { CountUp, MetricCard } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { changePct, sharePct, splitHours } from '../model/format';
import { Reveal } from './Reveal';

/** The strip across the top: five numbers for the chosen period, each against the one before. */
export function KpiStrip({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation('performance');
  const vs = t('vs', { days: report.days });
  const hours = (h: number) => {
    const { value, unit } = splitHours(h);
    return t(`unit.${unit}`, { value });
  };
  const duration = (d: PerformanceReport['cycleTime']) =>
    d.avgHours === null || d.medianHours === null ? null : d;

  const cycle = duration(report.cycleTime);
  const lead = duration(report.leadTime);
  const lateNow = sharePct(report.lateDone, report.doneWithDue);
  const latePrev = sharePct(report.previousLateDone, report.previousDoneWithDue);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Reveal index={0}>
        <MetricCard
          className="h-full"
          title={t('kpi.throughput.title')}
          value={<CountUp value={report.throughput.value} />}
          trend={report.throughput.changePct}
          delta={report.throughput.value - report.throughput.previous}
          trendLabel={vs}
          caption={t('kpi.throughput.caption')}
          spark={report.daily.map((d, i) => d.doneTotal - (report.daily[i - 1]?.doneTotal ?? 0))}
        />
      </Reveal>
      <Reveal index={1}>
        <MetricCard
          className="h-full"
          title={t('kpi.cycle.title')}
          value={cycle ? hours(cycle.avgHours!) : '—'}
          trend={cycle ? changePct(cycle.avgHours, cycle.previousAvgHours) : undefined}
          trendLabel={vs}
          inverse
          caption={
            cycle
              ? t('kpi.cycle.caption', { median: hours(cycle.medianHours!) })
              : t('kpi.cycle.empty')
          }
        />
      </Reveal>
      <Reveal index={2}>
        <MetricCard
          className="h-full"
          title={t('kpi.lead.title')}
          value={lead ? hours(lead.avgHours!) : '—'}
          trend={lead ? changePct(lead.avgHours, lead.previousAvgHours) : undefined}
          trendLabel={vs}
          inverse
          caption={
            lead ? t('kpi.lead.caption', { median: hours(lead.medianHours!) }) : t('kpi.lead.empty')
          }
        />
      </Reveal>
      <Reveal index={3}>
        <MetricCard
          className="h-full"
          title={t('kpi.late.title')}
          value={
            lateNow === null ? (
              <CountUp value={report.overdueNow} />
            ) : (
              <>
                <CountUp value={lateNow} />%
              </>
            )
          }
          trend={lateNow !== null ? changePct(lateNow, latePrev) : undefined}
          trendLabel={vs}
          inverse
          caption={
            lateNow === null
              ? t('kpi.late.captionNone', { now: report.overdueNow })
              : t('kpi.late.caption', {
                  late: report.lateDone,
                  total: report.doneWithDue,
                  now: report.overdueNow,
                })
          }
        />
      </Reveal>
      <Reveal index={4}>
        <MetricCard
          className="h-full"
          title={t('kpi.wip.title')}
          value={<CountUp value={report.wipInProgress + report.wipInReview} />}
          caption={t('kpi.wip.caption', {
            progress: report.wipInProgress,
            review: report.wipInReview,
          })}
        />
      </Reveal>
    </div>
  );
}
