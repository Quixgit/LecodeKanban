import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { transition } from '../motion/presets';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/**
 * List | Kanban | Calendar switcher. The white "thumb" slides between options
 * via a shared layoutId; arrow keys move selection (radiogroup semantics).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex h-control items-center rounded-lg bg-surface-muted p-1',
        className,
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative flex h-full items-center gap-2 rounded-md px-3 text-base transition-colors duration-micro',
              '[&_svg]:size-4 [&_svg]:stroke-[1.6]',
              active ? 'text-text' : 'text-text-muted hover:text-text',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={transition.spring}
                className="absolute inset-0 rounded-md bg-surface shadow-sm"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {opt.icon}
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
