import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Shimmering placeholder block. Compose these to mirror the real layout. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-sunken',
        'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-surface/60 after:to-transparent motion-safe:after:animate-shimmer',
        className,
      )}
      {...props}
    />
  );
}
