import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader, CardTitle, SegmentedControl } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { Legend, TooltipBox, TooltipRow } from './ChartParts';
import { axisLine, axisTick, gridStroke, useDayLabel } from './chartKit';

const CREATED = 'rgb(var(--c-series-todo))';
const DONE = 'rgb(var(--c-series-done))';

type View = 'weekly' | 'burnup';

/** Tasks closed per week (bars), or created and closed adding up over the period (burn-up). */
export function ThroughputCard({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation('performance');
  const day = useDayLabel();
  const [view, setView] = useState<View>('weekly');
  const rows =
    view === 'weekly'
      ? report.weekly.map((w) => ({ at: w.start, created: w.created, done: w.done }))
      : report.daily.map((d) => ({ at: d.date, created: d.createdTotal, done: d.doneTotal }));

  return (
    <Card className="p-5">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t('throughput.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('throughput.subtitle')}</p>
        </div>
        <SegmentedControl<View>
          label={t('throughput.title')}
          value={view}
          onChange={setView}
          options={[
            { value: 'weekly', label: t('throughput.weekly') },
            { value: 'burnup', label: t('throughput.burnup') },
          ]}
        />
      </CardHeader>
      <Legend
        label={t('throughput.title')}
        items={[
          { swatch: 'bg-series-todo', label: t('throughput.created') },
          { swatch: 'bg-series-done', label: t('throughput.done') },
        ]}
      />
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          {view === 'weekly' ? (
            <BarChart
              accessibilityLayer={false}
              accessibilityLayer={false}
              data={report.weekly}
              margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
              barGap={4}
              barCategoryGap="30%"
            >
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="start"
                tickFormatter={(d: string) => day(d)}
                tickLine={false}
                axisLine={axisLine}
                tick={axisTick}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
              <Tooltip
                cursor={{ fill: 'rgb(var(--c-surface-muted))' }}
                content={(p) => {
                  const w = p.payload?.[0]?.payload as
                    PerformanceReport['weekly'][number] | undefined;
                  if (!p.active || !w) return null;
                  return (
                    <TooltipBox title={t('throughput.weekOf', { date: day(w.start) })}>
                      <TooltipRow
                        swatch="bg-series-todo"
                        label={t('throughput.created')}
                        value={w.created}
                      />
                      <TooltipRow
                        swatch="bg-series-done"
                        label={t('throughput.done')}
                        value={w.done}
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Bar
                dataKey="created"
                fill={CREATED}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={600}
              />
              <Bar
                dataKey="done"
                fill={DONE}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={600}
              />
            </BarChart>
          ) : (
            <LineChart
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
                  const d = p.payload?.[0]?.payload as
                    PerformanceReport['daily'][number] | undefined;
                  if (!p.active || !d) return null;
                  return (
                    <TooltipBox title={day(d.date)}>
                      <TooltipRow
                        swatch="bg-series-todo"
                        label={t('throughput.created')}
                        value={d.createdTotal}
                      />
                      <TooltipRow
                        swatch="bg-series-done"
                        label={t('throughput.done')}
                        value={d.doneTotal}
                      />
                    </TooltipBox>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="createdTotal"
                stroke={CREATED}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'rgb(var(--c-surface))', strokeWidth: 2 }}
                animationDuration={700}
              />
              <Line
                type="monotone"
                dataKey="doneTotal"
                stroke={DONE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'rgb(var(--c-surface))', strokeWidth: 2 }}
                animationDuration={700}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('throughput.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('a11y.table')}</th>
            <th scope="col">{t('throughput.created')}</th>
            <th scope="col">{t('throughput.done')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.at}>
              <th scope="row">{day(r.at)}</th>
              <td>{r.created}</td>
              <td>{r.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
