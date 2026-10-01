import { useId, type ReactElement, type ReactNode } from 'react';
import { cloneElement } from 'react';
import { cn } from '../lib/cn';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean }>;
}

/** Label + control + hint/error with correct ARIA wiring. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {cloneElement(children, {
        id,
        invalid: !!error,
        'aria-describedby': hint || error ? descId : undefined,
      })}
      {(error || hint) && (
        <p id={descId} className={cn('text-xs', error ? 'text-danger-ink' : 'text-text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
