import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

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
 * List | Kanban | Calendar switcher. The white "thumb" slides between options with a CSS
 * transition on its measured position (a framer shared layout would keep a closing drawer or
 * dialog mounted); arrow keys move selection (radiogroup semantics).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  // Follow the active option, including when fonts load or the container resizes.
  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[options.findIndex((o) => o.value === value)];
      if (el)
        setThumb((p) =>
          p?.x === el.offsetLeft && p.w === el.offsetWidth
            ? p
            : { x: el.offsetLeft, w: el.offsetWidth },
        );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (group.current) ro.observe(group.current);
    return () => ro.disconnect();
  }, [options, value]);

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
      ref={group}
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative inline-flex h-control items-center rounded-lg bg-surface-sunken p-1',
        className,
      )}
    >
      {thumb && (
        <span
          aria-hidden
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
          className="absolute inset-y-1 left-0 rounded-md border border-border bg-surface shadow-sm transition-[transform,width] duration-ui ease-out"
        />
      )}
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
              'relative flex h-full items-center gap-2 rounded-md px-2.5 text-base transition-colors duration-micro',
              '[&_svg]:size-4 [&_svg]:stroke-[1.6]',
              active ? 'text-text' : 'text-text-muted hover:text-text',
            )}
          >
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
