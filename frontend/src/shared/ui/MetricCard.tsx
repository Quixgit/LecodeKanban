import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Card } from './Card';
import { Sparkline } from './Sparkline';
import { TrendChip } from './TrendChip';

export interface MetricCardProps {
  title: ReactNode;
  value: ReactNode;
  total?: ReactNode;
  /** Percent change; null when the previous period was empty (then the absolute `delta` is shown). */
  trend?: number | null;
  /** Change in the count itself, for when a percentage has nothing to compare with. */
  delta?: number;
  trendLabel?: ReactNode;
  /** Secondary line shown when there is no trend. */
  caption?: ReactNode;
  /** Top-right slot, typically an IconButton with "…" menu. */
  menu?: ReactNode;
  /** Daily values drawn as a small line under the number. */
  spark?: number[];
  /** Lower is better: a rise reads as bad. */
  inverse?: boolean;
  className?: string;
}

/** Large dashboard KPI ("Active Employees 81 / 96  ↗1.50% Than yesterday"). */
export function MetricCard({
  title,
  value,
  total,
  trend,
  delta = 0,
  trendLabel,
  caption,
  menu,
  spark,
  inverse,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('flex flex-col gap-5 p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-medium text-text">{title}</h3>
        {menu}
      </div>
      <p className="tabular text-3xl font-semibold tracking-tight text-text">
        {value}
        {total !== undefined && <span className="font-medium text-text-faint"> / {total}</span>}
      </p>
      {spark && (
        <Sparkline
          values={spark}
          className={cn(
            (trend ?? delta) === 0
              ? 'text-text-faint'
              : (trend ?? delta) > 0 !== !!inverse
                ? 'text-done'
                : 'text-danger',
          )}
        />
      )}
      {caption && <p className="text-sm text-text-secondary">{caption}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          {trend === null ? (
            <TrendChip
              value={delta}
              format={(n) => String(Math.round(n))}
              className={delta === 0 ? 'bg-surface-sunken text-text-secondary' : undefined}
              flat={delta === 0}
              inverse={inverse}
            />
          ) : (
            <TrendChip value={trend} inverse={inverse} />
          )}
          {trendLabel}
        </div>
      )}
    </Card>
  );
}
