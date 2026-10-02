import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { statusTone, toneClasses, type TaskStatus } from './tones';

/**
 * Group header tag from the Tasks list ("▌To Do"): soft rounded block with a
 * vertical colour bar. Text uses the status ink except To Do which is plain text.
 */
export function StatusTag({
  status,
  label,
  className,
  ...props
}: {
  status: TaskStatus;
  /** Custom column name; defaults to the status name. */
  label?: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  const { t } = useTranslation();
  const tone = toneClasses[statusTone[status]];
  return (
    <span
      className={cn(
        'inline-flex h-9 items-center gap-2.5 rounded-lg pl-3 pr-3.5 text-md font-medium',
        tone.soft,
        tone.ink,
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn('h-4 w-[3px] rounded-full', tone.fill)} />
      <span className="truncate">{label ?? t(`status.${status}`)}</span>
    </span>
  );
}
