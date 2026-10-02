import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Bordered data table matching the screenshots: rounded outer frame,
 * muted header row, vertical column dividers and subtle row separators.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className={cn('w-full border-collapse text-left text-base', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted text-text-secondary', className)} {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TR({
  className,
  selected,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        'border-b border-border-subtle transition-colors duration-micro last:border-b-0',
        '[tbody_&]:hover:bg-surface-muted/70',
        selected && 'bg-primary-subtle [tbody_&]:hover:bg-primary-subtle',
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = 'asc' | 'desc' | false;

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sort?: SortDirection;
  onSort?: () => void;
  align?: 'left' | 'right' | 'center';
}

export function TH({
  className,
  sortable,
  sort = false,
  onSort,
  align = 'left',
  children,
  ...props
}: THProps) {
  const Icon = sort === 'asc' ? ChevronUp : sort === 'desc' ? ChevronDown : ChevronsUpDown;
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-between';
  return (
    <th
      scope="col"
      aria-sort={
        sort === 'asc'
          ? 'ascending'
          : sort === 'desc'
            ? 'descending'
            : sortable
              ? 'none'
              : undefined
      }
      className={cn(
        'h-11 whitespace-nowrap border-r border-border-subtle px-3 font-normal last:border-r-0',
        className,
      )}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            '-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded px-1 hover:text-text',
            justify,
          )}
        >
          {children}
          <Icon
            className={cn('size-4 stroke-[1.6]', sort ? 'text-text' : 'text-text-faint')}
            aria-hidden
          />
        </button>
      ) : (
        <div className={cn('flex items-center', justify)}>{children}</div>
      )}
    </th>
  );
}

export function TD({
  className,
  align,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'h-row border-r border-border-subtle px-3 text-text-secondary last:border-r-0',
        align === 'right' && 'tabular text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  );
}
