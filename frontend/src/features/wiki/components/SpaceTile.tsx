import { cn } from '@/shared/lib/cn';
import { toneClasses } from '@/shared/ui';
import { DEFAULT_SPACE_ICON, iconFor } from '../model/icons';
import { toneOf } from '../model/style';

const sizes = {
  xs: { box: 'size-5 rounded-md', icon: 'size-3' },
  sm: { box: 'size-7 rounded-lg', icon: 'size-4' },
  md: { box: 'size-9 rounded-xl', icon: 'size-[18px]' },
  lg: { box: 'size-14 rounded-2xl', icon: 'size-7' },
} as const;

/** Square tile with the space's outline icon on its tone. */
export function SpaceTile({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string;
  color: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const tone = toneClasses[toneOf(color)];
  const Icon = iconFor(icon) ?? iconFor(DEFAULT_SPACE_ICON)!;
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        sizes[size].box,
        tone.soft,
        tone.ink,
        className,
      )}
    >
      <Icon className={cn(sizes[size].icon, 'stroke-[1.6]')} />
    </span>
  );
}
