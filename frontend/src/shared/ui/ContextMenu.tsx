import * as ContextPrimitive from '@radix-ui/react-context-menu';
import { Check, ChevronRight } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../lib/cn';

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;
export const ContextMenuRadioGroup = ContextPrimitive.RadioGroup;
export const ContextMenuSub = ContextPrimitive.Sub;

const surface =
  'z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-surface p-1.5 shadow-lg ' +
  'origin-[var(--radix-context-menu-content-transform-origin)] ' +
  'data-[state=open]:animate-[lk-pop-in_var(--dur-ui)_var(--ease-out)] ' +
  'data-[state=closed]:animate-[lk-pop-out_var(--dur-micro)_var(--ease-out)]';

const itemBase =
  'relative flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-base text-text outline-none ' +
  'transition-colors duration-micro data-[disabled]:pointer-events-none data-[disabled]:text-text-faint ' +
  'data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:stroke-[1.6] [&_svg]:text-text-muted';

export const ContextMenuContent = forwardRef<
  ElementRef<typeof ContextPrimitive.Content>,
  ComponentPropsWithoutRef<typeof ContextPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextPrimitive.Portal>
    <ContextPrimitive.Content ref={ref} className={cn(surface, className)} {...props} />
  </ContextPrimitive.Portal>
));
ContextMenuContent.displayName = 'ContextMenuContent';

export const ContextMenuItem = forwardRef<
  ElementRef<typeof ContextPrimitive.Item>,
  ComponentPropsWithoutRef<typeof ContextPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <ContextPrimitive.Item
    ref={ref}
    className={cn(itemBase, danger && 'text-danger-ink [&_svg]:text-danger-ink', className)}
    {...props}
  />
));
ContextMenuItem.displayName = 'ContextMenuItem';

/** A choice with a description under it, ticked when it is the current value. */
export const ContextMenuRadioItem = forwardRef<
  ElementRef<typeof ContextPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof ContextPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextPrimitive.RadioItem ref={ref} className={cn(itemBase, 'pr-8', className)} {...props}>
    {children}
    <ContextPrimitive.ItemIndicator className="absolute right-2.5 flex">
      <Check className="!text-primary" />
    </ContextPrimitive.ItemIndicator>
  </ContextPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

export const ContextMenuSubTrigger = forwardRef<
  ElementRef<typeof ContextPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof ContextPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <ContextPrimitive.SubTrigger
    ref={ref}
    className={cn(itemBase, 'pr-8 data-[state=open]:bg-surface-muted', className)}
    {...props}
  >
    {children}
    <ChevronRight className="absolute right-2.5" />
  </ContextPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

export const ContextMenuSubContent = forwardRef<
  ElementRef<typeof ContextPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof ContextPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextPrimitive.Portal>
    <ContextPrimitive.SubContent
      ref={ref}
      sideOffset={6}
      className={cn(surface, 'min-w-[200px]', className)}
      {...props}
    />
  </ContextPrimitive.Portal>
));
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

export function ContextMenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ContextPrimitive.Label>) {
  return (
    <ContextPrimitive.Label
      className={cn(
        'px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof ContextPrimitive.Separator>) {
  return (
    <ContextPrimitive.Separator
      className={cn('-mx-1.5 my-1.5 h-px bg-border-subtle', className)}
      {...props}
    />
  );
}
