import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Kbd, Tooltip } from '@/shared/ui';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** Shortcut shown in the tooltip, e.g. ["Ctrl", "B"]. */
  keys?: string[];
  active?: boolean;
  children: ReactNode;
}

/** An icon button for the editor bars: pressed state, tooltip with shortcut, never steals the caret. */
export const ToolbarButton = forwardRef<HTMLButtonElement, Props>(function ToolbarButton(
  { label, keys, active, className, children, ...props },
  ref,
) {
  return (
    <Tooltip
      content={
        <span className="flex items-center gap-2">
          {label}
          {keys && (
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k} className="bg-surface/20 text-surface">
                  {k}
                </Kbd>
              ))}
            </span>
          )}
        </span>
      }
    >
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={active}
        // keep the editor selection while clicking the bar
        onMouseDown={(e) => e.preventDefault()}
        className={cn('lk-tb', active && 'is-active', className)}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
