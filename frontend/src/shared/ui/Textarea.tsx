import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { fieldGlow, fieldGlowInvalid, fieldSurface } from './fieldStyles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'min-h-24 w-full resize-y rounded-lg px-3 py-2.5 text-base text-text outline-none placeholder:text-text-faint focus-visible:shadow-none',
        fieldSurface,
        invalid ? fieldGlowInvalid : cn('border-border', fieldGlow),
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
