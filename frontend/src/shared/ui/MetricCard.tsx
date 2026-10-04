import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Card } from './Card';
import { TrendChip } from './TrendChip';

export interface MetricCardProps {
  title: ReactNode;
  value: ReactNode;
  total?: ReactNode;
  /** Percent change; null when there was nothing to compare with (then `trendEmpty` is shown). */
  trend?: number | null;
  trendEmpty?: ReactNode;
  trendLabel?: ReactNode;
  /** Secondary line shown when there is no trend. */
  caption?: ReactNode;
  /** Top-right slot, typically an IconButton with "…" menu. */
  menu?: ReactNode;
  className?: string;
}

/** Large dashboard KPI ("Active Employees 81 / 96  ↗1.50% Than yesterday"). */
export function MetricCard({
  title,
  value,
  total,
  trend,
  trendEmpty,
  trendLabel,
  caption,
  menu,
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
      {trend === undefined && caption && <p className="text-sm text-text-secondary">{caption}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          {trend === null ? (
            <span className="tabular inline-flex h-6 items-center rounded-sm bg-surface-sunken px-1.5 text-xs font-medium text-text-secondary">
              {trendEmpty ?? '—'}
            </span>
          ) : (
            <TrendChip value={trend} />
          )}
          {trendLabel}
        </div>
      )}
    </Card>
  );
}
