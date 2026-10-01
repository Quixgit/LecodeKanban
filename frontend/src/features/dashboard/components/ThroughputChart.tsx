import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STATUSES, type DashboardStats, type TaskStatus } from '@/features/cards';
import { useLanguage } from '@/shared/i18n';
import { Card, CardHeader, CardTitle, SegmentedControl } from '@/shared/ui';
import { seriesBg, seriesColor } from './series';

type Day = DashboardStats['daily'][number];

const dayLabel = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  label?: string | number;
}

function ChartTooltip({ active, payload, label }: TipProps) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  if (!active || !payload?.length) return null;
  const day = payload[0]!.payload as Day;
  return (
    <div className="min-w-44 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
      <p className="mb-2 font-medium text-text">{dayLabel(String(label), language)}</p>
      <ul className="flex flex-col gap-1.5">
        {[...STATUSES].reverse().map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 rounded-sm ${seriesBg[s]}`} />
            <span className="flex-1 text-text-secondary">{t(`heatmap.legend.${s}`)}</span>
            <span className="tabular font-medium text-text">{day[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Status changes per day, stacked by target status (adaptation of the reference
 * "attendance" chart). Legend + tooltip + a screen-reader table carry identity and values.
 */
export function ThroughputChart({
  daily,
  days,
  onDaysChange,
}: {
  daily: Day[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  const top = (d: Day): TaskStatus | undefined => [...STATUSES].reverse().find((s) => d[s] > 0);

  return (
    <Card className="p-5">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t('heatmap.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('heatmap.subtitle')}</p>
        </div>
        <SegmentedControl<string>
          label={t('heatmap.title')}
          value={String(days)}
          onChange={(v) => onDaysChange(Number(v))}
          options={[
            { value: '7', label: t('heatmap.range.7') },
            { value: '14', label: t('heatmap.range.14') },
          ]}
        />
      </CardHeader>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label={t('heatmap.title')}>
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-sm text-text-secondary">
            <span aria-hidden className={`size-2.5 rounded-sm ${seriesBg[s]}`} />
            {t(`heatmap.legend.${s}`)}
          </li>
        ))}
      </ul>
      <div className="h-60" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={daily}
            margin={{ top: 4, right: 4, bottom: 0, left: -18 }}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={false} stroke="rgb(var(--c-border-subtle))" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => dayLabel(d, language)}
              tickLine={false}
              axisLine={{ stroke: 'rgb(var(--c-border))' }}
              tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12 }}
              interval={days > 7 ? 1 : 0}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'rgb(var(--c-text-muted))', fontSize: 12 }}
            />
            <Tooltip
              content={(p) => (
                <ChartTooltip
                  active={p.active}
                  payload={p.payload as TipProps['payload']}
                  label={p.label as string}
                />
              )}
              cursor={{ fill: 'rgb(var(--c-surface-muted))' }}
            />
            {STATUSES.map((s) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="status"
                fill={seriesColor[s]}
                stroke="rgb(var(--c-surface))"
                strokeWidth={2}
                maxBarSize={24}
                isAnimationActive
                animationDuration={600}
                shape={(props: {
                  x?: number;
                  y?: number;
                  width?: number;
                  height?: number;
                  payload?: Day;
                  fill?: string;
                }) => {
                  const { x = 0, y = 0, width = 0, height = 0, payload, fill } = props;
                  if (height <= 0) return <g />;
                  const r = payload && top(payload) === s ? Math.min(4, height / 2) : 0;
                  // Rounded data-end on the topmost segment only; square at the baseline.
                  const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
                  return <path d={d} fill={fill} stroke="rgb(var(--c-surface))" strokeWidth={2} />;
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t('heatmap.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('heatmap.tooltip', { date: '' })}</th>
            {STATUSES.map((s) => (
              <th key={s} scope="col">
                {t(`heatmap.legend.${s}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date, language)}</th>
              {STATUSES.map((s) => (
                <td key={s}>{d[s]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
