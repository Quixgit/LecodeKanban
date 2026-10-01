import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/cn';

export interface TrendChipProps {
  /** Signed percentage change, e.g. 1.5 or -10.5. */
  value: number;
  format?: (abs: number) => string;
  className?: string;
}

export function TrendChip({
  value,
  format = (v) => `${v.toFixed(2)}%`,
  className,
}: TrendChipProps) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        'tabular inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs font-medium',
        up ? 'bg-done-soft text-done-ink' : 'bg-danger-soft text-danger-ink',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{up ? '+' : '−'}</span>
      {format(Math.abs(value))}
    </span>
  );
}
