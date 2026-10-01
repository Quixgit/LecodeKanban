import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Select, type SelectOption } from './Select';

const ANY = '__any__';

export interface FilterSelectProps {
  label: string;
  /** Shown when nothing is selected (usually the filter name). */
  placeholder: ReactNode;
  anyLabel: ReactNode;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: SelectOption[];
  className?: string;
}

/** Toolbar filter ("Status ⌄"): an "any" option clears it; active filters are highlighted. */
export function FilterSelect({
  label,
  placeholder,
  anyLabel,
  value,
  onChange,
  options,
  className,
}: FilterSelectProps) {
  return (
    <Select
      label={label}
      placeholder={placeholder}
      value={value ?? ''}
      onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      options={[{ value: ANY, label: anyLabel }, ...options]}
      className={cn(value && 'border-primary-border bg-primary-subtle text-primary-ink', className)}
    />
  );
}
