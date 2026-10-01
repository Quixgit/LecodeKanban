import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../lib/cn';

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;
export const DropdownGroup = DropdownPrimitive.Group;
export const DropdownRadioGroup = DropdownPrimitive.RadioGroup;

const surface =
  'z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface p-1.5 shadow-lg ' +
  'origin-[var(--radix-dropdown-menu-content-transform-origin)] ' +
  'data-[state=open]:animate-[lk-pop-in_var(--dur-ui)_var(--ease-out)] ' +
  'data-[state=closed]:animate-[lk-pop-out_var(--dur-micro)_var(--ease-out)]';

export const DropdownContent = forwardRef<
  ElementRef<typeof DropdownPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 8, align = 'end', ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(surface, className)}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownContent.displayName = 'DropdownContent';

const itemBase =
  'relative flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-base text-text outline-none ' +
  'transition-colors duration-micro data-[disabled]:pointer-events-none data-[disabled]:text-text-faint ' +
  'data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:stroke-[1.6] [&_svg]:text-text-muted';

export const DropdownItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(itemBase, danger && 'text-danger-ink [&_svg]:text-danger-ink', className)}
    {...props}
  />
));
DropdownItem.displayName = 'DropdownItem';

export const DropdownRadioItem = forwardRef<
  ElementRef<typeof DropdownPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownPrimitive.RadioItem ref={ref} className={cn(itemBase, 'pr-8', className)} {...props}>
    {children}
    <DropdownPrimitive.ItemIndicator className="absolute right-2.5 flex">
      <Check className="!text-primary" />
    </DropdownPrimitive.ItemIndicator>
  </DropdownPrimitive.RadioItem>
));
DropdownRadioItem.displayName = 'DropdownRadioItem';

export function DropdownLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        'px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn('-mx-1.5 my-1.5 h-px bg-border-subtle', className)}
      {...props}
    />
  );
}
