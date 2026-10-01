import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { Input, type InputProps } from './Input';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailing'> {
  showLabel: string;
  hideLabel: string;
}

/** Password field with a visibility toggle (keeps focus in the input). */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showLabel, hideLabel, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        leadingIcon={<LockKeyhole />}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={visible ? hideLabel : showLabel}
            aria-pressed={visible}
            className="-mr-1 rounded-md p-1 text-text-muted transition-colors hover:text-text [&_svg]:size-[18px] [&_svg]:stroke-[1.6]"
          >
            {visible ? <EyeOff /> : <Eye />}
          </button>
        }
        {...props}
      />
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
