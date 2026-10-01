import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift slightly on hover (interactive cards). */
  interactive?: boolean;
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, padded = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border-subtle bg-surface shadow-sm',
        padded && 'p-5',
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-ui ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-md',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-medium text-text', className)} {...props} />;
}
