import { CalendarDays } from 'lucide-react';
import { forwardRef } from 'react';
import { Input, type InputProps } from './Input';

/** Native date picker (accessible, localized by the browser) in the design-system frame. Value: YYYY-MM-DD. */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'leadingIcon'>>(
  (props, ref) => (
    <Input
      ref={ref}
      type="date"
      leadingIcon={<CalendarDays />}
      className="[&::-webkit-calendar-picker-indicator]:opacity-60"
      {...props}
    />
  ),
);
DateInput.displayName = 'DateInput';
