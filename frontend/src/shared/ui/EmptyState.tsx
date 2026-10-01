import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      {icon && (
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink [&_svg]:size-6 [&_svg]:stroke-[1.6]">
          {icon}
        </span>
      )}
      <p className="text-md font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-base text-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
