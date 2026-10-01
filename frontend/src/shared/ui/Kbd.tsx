import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-xs bg-surface-sunken px-1.5 font-sans text-2xs font-medium text-text-muted',
        className,
      )}
      {...props}
    />
  );
}
