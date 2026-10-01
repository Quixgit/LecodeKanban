import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Card } from './Card';
import { toneClasses, type Tone } from './tones';

export interface StatCardProps {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  /** Muted denominator shown as " / 100". */
  total?: ReactNode;
  iconTone?: Tone | 'plain';
  className?: string;
}

/** Compact KPI tile from the Projects/Payroll headers: icon box + label + value. */
export function StatCard({
  icon,
  label,
  value,
  total,
  iconTone = 'plain',
  className,
}: StatCardProps) {
  const toneInk = iconTone === 'plain' ? 'text-text' : toneClasses[iconTone].ink;
  return (
    <Card className={cn('flex items-center gap-4 px-4 py-4', className)}>
      <span
        aria-hidden
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-muted [&_svg]:size-5 [&_svg]:stroke-[1.6]',
          toneInk,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-text-secondary">{label}</p>
        <p className="tabular mt-0.5 text-xl font-semibold text-text">
          {value}
          {total !== undefined && <span className="font-medium text-text-faint"> / {total}</span>}
        </p>
      </div>
    </Card>
  );
}
