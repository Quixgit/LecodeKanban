import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export interface SelectProps {
  value?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: ReactNode;
  /** Inline prefix like "Pay Period:" rendered before the value. */
  prefix?: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** Filter-style select ("Status ⌄", "Pay Period: May 2025 ⌄"). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  prefix,
  label,
  className,
  disabled,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-control items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-base text-text-secondary shadow-xs',
          'transition-[border-color,box-shadow] duration-micro ease-out hover:border-border-strong',
          'data-[state=open]:border-primary data-[placeholder]:text-text-secondary data-[state=open]:shadow-focus',
          className,
        )}
      >
        {prefix && <span className="text-text-muted">{prefix}</span>}
        <span className={cn(prefix && 'font-medium text-text')}>
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 stroke-[1.6] text-text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface p-1.5 shadow-lg data-[state=open]:animate-[lk-pop-in_var(--dur-ui)_var(--ease-out)]"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex h-9 cursor-pointer select-none items-center rounded-md pl-2.5 pr-8 text-base text-text outline-none data-[highlighted]:bg-surface-muted"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-primary" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
