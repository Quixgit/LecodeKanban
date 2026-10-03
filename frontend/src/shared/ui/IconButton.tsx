import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

const iconButtonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center text-text-secondary',
    'transition-[background-color,border-color,color,transform] duration-micro ease-out active:scale-95',
    'disabled:pointer-events-none disabled:text-text-faint',
    '[&_svg]:size-[18px] [&_svg]:stroke-[1.6]',
  ],
  {
    variants: {
      variant: {
        outline:
          'border border-border bg-surface shadow-xs hover:border-border-strong hover:text-text',
        ghost: 'hover:bg-surface-sunken hover:text-text',
      },
      size: {
        sm: 'size-8 rounded-md [&_svg]:size-4',
        md: 'size-10 rounded-lg',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  /** Shows a small red dot (e.g. unread notifications). */
  dot?: boolean;
  /** Shows a red count pill (e.g. unread notifications); 99+ when large, nothing at zero. */
  count?: number;
  /** Render the single child (e.g. a router Link) with icon-button styling. */
  asChild?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, label, dot, count, asChild, children, ...props }, ref) =>
    asChild ? (
      <Slot
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Slot>
    ) : (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
        {count !== undefined && count > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-2xs font-semibold tabular-nums leading-none text-white ring-2 ring-surface motion-safe:animate-[lk-pop-in_var(--dur-micro)_var(--ease-out)]"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
        {dot && (
          <span
            aria-hidden
            className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface"
          />
        )}
      </button>
    ),
);
IconButton.displayName = 'IconButton';
