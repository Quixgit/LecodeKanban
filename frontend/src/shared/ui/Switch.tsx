import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '../lib/cn';

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5',
      'bg-border-strong transition-colors duration-ui ease-out data-[state=checked]:bg-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-[18px] rounded-full bg-white shadow-sm transition-transform duration-ui ease-out data-[state=checked]:translate-x-4" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
