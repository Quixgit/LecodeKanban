import { X } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — the button has no visible text. */
  label: string;
  size?: 'sm' | 'md';
}

/** The one "close" control: a soft rounded tile whose cross turns a quarter on hover, like the board's cards. */
export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ className, label, size = 'sm', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        'group/close relative inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-text-muted',
        'transition-[background-color,border-color,color,transform] duration-micro ease-out',
        'hover:border-border hover:bg-surface-sunken hover:text-text active:scale-90',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...props}
    >
      <X
        aria-hidden
        className="size-[18px] stroke-[1.8] transition-transform duration-ui ease-out group-hover/close:rotate-90 motion-reduce:transition-none motion-reduce:group-hover/close:rotate-0"
      />
    </button>
  ),
);
CloseButton.displayName = 'CloseButton';
