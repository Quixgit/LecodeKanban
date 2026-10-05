import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STATUSES, type TaskStatus } from '@/features/cards';
import { seriesBg, seriesColor } from '../model/series';
import { Card, CardHeader, CardTitle } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { Legend, TooltipBox, TooltipRow } from './ChartParts';
import { axisLine, axisTick, gridStroke, useDayLabel } from './chartKit';

const KEY: Record<TaskStatus, 'todo' | 'inProgress' | 'inReview' | 'done'> = {
  todo: 'todo',
  in_progress: 'inProgress',
  in_review: 'inReview',
  done: 'done',
};

/** Cumulative flow: how many tasks sit in each status on each day. A band that keeps widening is a bottleneck. */
export function FlowCard({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation(['performance', 'common']);
  const day = useDayLabel();
  return (
    <Card className="p-5">
      <CardHeader>
        <div>
          <CardTitle>{t('performance:flow.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('performance:flow.subtitle')}</p>
        </div>
      </CardHeader>
      <Legend
        label={t('performance:flow.title')}
        items={[...STATUSES].map((s) => ({ swatch: seriesBg[s], label: t(`common:status.${s}`) }))}
      />
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            accessibilityLayer={false}
            data={report.daily}
            margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
          >
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => day(d)}
              tickLine={false}
              axisLine={axisLine}
              tick={axisTick}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
            <Tooltip
              cursor={{ stroke: 'rgb(var(--c-border))' }}
              content={(p) => {
                const d = p.payload?.[0]?.payload as PerformanceReport['daily'][number] | undefined;
                if (!p.active || !d) return null;
                return (
                  <TooltipBox title={day(d.date)}>
                    {[...STATUSES].reverse().map((s) => (
                      <TooltipRow
                        key={s}
                        swatch={seriesBg[s]}
                        label={t(`common:status.${s}`)}
                        value={d[KEY[s]]}
                      />
                    ))}
                  </TooltipBox>
                );
              }}
            />
            {/* Bottom to top: done at the base so the open bands read against it. */}
            {[...STATUSES].reverse().map((s) => (
              <Area
                key={s}
                type="monotone"
                dataKey={KEY[s]}
                stackId="flow"
                stroke={seriesColor[s]}
                fill={seriesColor[s]}
                fillOpacity={0.55}
                strokeWidth={1.5}
                animationDuration={700}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-sm text-text-muted">{t('performance:flow.hint')}</p>
      <table className="sr-only">
        <caption>{t('performance:flow.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('performance:a11y.table')}</th>
            {STATUSES.map((s) => (
              <th key={s} scope="col">
                {t(`common:status.${s}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{day(d.date)}</th>
              {STATUSES.map((s) => (
                <td key={s}>{d[KEY[s]]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
