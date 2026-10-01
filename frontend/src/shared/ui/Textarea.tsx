import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-24 w-full resize-y rounded-lg border bg-surface px-3 py-2.5 text-base text-text outline-none transition-[border-color,box-shadow] duration-micro ease-out placeholder:text-text-faint',
        'focus:border-primary focus:shadow-focus',
        invalid ? 'border-danger' : 'border-border hover:border-border-strong',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
