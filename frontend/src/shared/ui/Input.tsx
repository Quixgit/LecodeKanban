import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  /** Classes for the outer wrapper (width, margins). */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, leadingIcon, trailing, invalid, ...props }, ref) => (
    <div
      className={cn(
        'group flex h-control items-center gap-2 rounded-lg border bg-surface px-3 transition-[border-color,box-shadow] duration-micro ease-out',
        'focus-within:border-primary focus-within:shadow-focus',
        invalid
          ? 'border-danger focus-within:border-danger'
          : 'border-border hover:border-border-strong',
        props.disabled && 'bg-surface-sunken',
        wrapperClassName,
      )}
    >
      {leadingIcon && (
        <span className="flex text-text-muted [&_svg]:size-[18px] [&_svg]:stroke-[1.6]" aria-hidden>
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-faint focus-visible:shadow-none disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  ),
);
Input.displayName = 'Input';
