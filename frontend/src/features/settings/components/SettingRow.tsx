import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/** One setting: what it is on the left, its control on the right. Rows stack inside a SettingsCard. */
export function SettingRow({
  icon,
  title,
  description,
  children,
  stack,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  /** Put the control under the text (wide controls such as a tag box). */
  stack?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-4 border-b border-border-subtle py-4 first:pt-0 last:border-b-0 last:pb-0',
        stack ? 'flex-col' : 'flex-col sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary-ink [&_svg]:size-[18px] [&_svg]:stroke-[1.7]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">{title}</p>
          {description && (
            <p className="mt-0.5 max-w-prose text-sm text-text-muted">{description}</p>
          )}
        </div>
      </div>
      <div className={cn('shrink-0', stack && 'w-full')}>{children}</div>
    </div>
  );
}
