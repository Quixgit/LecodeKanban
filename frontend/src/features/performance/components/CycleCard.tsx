import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { transition } from '@/shared/motion';
import { Avatar, Card, CardHeader, CardTitle, EmptyState } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { bucketLabel, splitHours } from '../model/format';
import { TooltipBox, TooltipRow } from './ChartParts';
import { axisLine, axisTick, gridStroke } from './chartKit';

/** Histogram of cycle times, so a handful of slow tasks shows up as a tail instead of skewing an average. */
export function CycleCard({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation(['performance', 'common']);
  const edges = report.histogram.map((b) => b.upToDays);
  const data = report.histogram.map((b, i) => ({ label: bucketLabel(edges, i), count: b.count }));
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <Card className="p-5">
      <CardHeader>
        <div>
          <CardTitle>{t('performance:cycle.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('performance:cycle.subtitle')}</p>
        </div>
        <span className="tabular text-sm text-text-muted">
          {t('performance:cycle.tasks', { count: total })}
        </span>
      </CardHeader>
      {total === 0 ? (
        <EmptyState className="py-8" title={t('performance:cycle.emptyHistogram')} />
      ) : (
        <div className="h-52" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              accessibilityLayer={false}
              accessibilityLayer={false}
              data={data}
              margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
              barCategoryGap="22%"
            >
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis dataKey="label" tickLine={false} axisLine={axisLine} tick={axisTick} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
              <Tooltip
                cursor={{ fill: 'rgb(var(--c-surface-muted))' }}
                content={(p) => {
                  const d = p.payload?.[0]?.payload as (typeof data)[number] | undefined;
                  if (!p.active || !d) return null;
                  return (
                    <TooltipBox
                      title={`${d.label} ${t('performance:unit.days', { value: '' }).trim()}`}
                    >
                      <TooltipRow
                        swatch="bg-series-progress"
                        label={t('performance:cycle.tasks', { count: d.count })}
                        value={d.count}
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Bar
                dataKey="count"
                fill="rgb(var(--c-series-progress))"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                animationDuration={600}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="sr-only">
        <caption>{t('performance:cycle.title')}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AgedList aged={report.aged} />
    </Card>
  );
}

function AgedList({ aged }: { aged: PerformanceReport['aged'] }) {
  const { t } = useTranslation(['performance', 'common']);
  const reduce = useReducedMotion();
  const max = Math.max(1, ...aged.map((a) => a.ageHours));
  return (
    <section className="mt-6" aria-labelledby="perf-aged">
      <h3 id="perf-aged" className="text-base font-medium text-text">
        {t('performance:aged.title')}
      </h3>
      <p className="mb-3 text-sm text-text-muted">{t('performance:aged.subtitle')}</p>
      {aged.length === 0 ? (
        <p className="py-3 text-sm text-text-secondary">{t('performance:aged.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {aged.map((a, i) => {
            const { value, unit } = splitHours(a.ageHours);
            return (
              <li key={a.id}>
                <Link
                  to={`/tasks?card=${a.id}`}
                  className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md py-0.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="tabular shrink-0 text-xs font-medium text-text-muted">
                      {a.key}
                    </span>
                    <span className="truncate text-sm text-text group-hover:text-primary">
                      {a.title}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex -space-x-1.5">
                      {a.assignees.slice(0, 3).map((p) => (
                        <Avatar key={p.id} name={p.name} src={p.avatarUrl} size="xs" ring />
                      ))}
                    </span>
                    <span className="tabular w-14 text-right text-sm font-medium text-text">
                      {t(`performance:unit.${unit}`, { value })}
                    </span>
                  </span>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <motion.span
                      className={`block h-full origin-left rounded-full ${a.status === 'in_review' ? 'bg-series-review' : 'bg-series-progress'}`}
                      style={{ width: `${(a.ageHours / max) * 100}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...transition.large, duration: 0.6, delay: i * 0.04 }}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
