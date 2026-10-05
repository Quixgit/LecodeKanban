import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** When false the tooltip is not rendered (e.g. only show labels when sidebar is collapsed). */
  enabled?: boolean;
}

export function Tooltip({ content, children, side = 'top', enabled = true }: TooltipProps) {
  if (!enabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className={cn(
            'z-50 max-w-64 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text shadow-lg',
            'origin-[var(--radix-tooltip-content-transform-origin)] data-[state=delayed-open]:animate-[lk-pop-in_var(--dur-micro)_var(--ease-out)]',
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
