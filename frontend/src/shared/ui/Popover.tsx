import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../lib/cn';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/** Floating panel for rich content (an emoji picker, filters): unlike a menu it may hold inputs. */
export const PopoverContent = forwardRef<
  ElementRef<typeof PopoverPrimitive.Content>,
  ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 8, align = 'start', ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      collisionPadding={12}
      className={cn(
        'z-50 rounded-xl border border-border bg-surface shadow-lg outline-none',
        'origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-[lk-pop-in_var(--dur-micro)_var(--ease-out)]',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';
