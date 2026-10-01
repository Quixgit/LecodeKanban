import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '../lib/cn';
import { hueFor, initials } from '../lib/initials';

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-2xs',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
  xl: 'size-14 text-base',
} as const;

export type AvatarSize = keyof typeof sizes;

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Adds a surface-coloured ring (used when avatars overlap). */
  ring?: boolean;
}

export function Avatar({ name, src, size = 'md', className, ring }: AvatarProps) {
  const hue = hueFor(name);
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 select-none overflow-hidden rounded-full align-middle',
        sizes[size],
        ring && 'ring-2 ring-surface',
        className,
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        aria-label={name}
        className="flex size-full items-center justify-center font-semibold"
        style={{
          background: `hsl(${hue} 55% 90%)`,
          color: `hsl(${hue} 45% 32%)`,
        }}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export interface AvatarGroupProps {
  people: { name: string; src?: string | null }[];
  max?: number;
  /** Total count when `people` is only a preview (shows "+N"). */
  total?: number;
  size?: AvatarSize;
  className?: string;
}

export function AvatarGroup({ people, max = 3, total, size = 'md', className }: AvatarGroupProps) {
  const shown = people.slice(0, max);
  const extra = (total ?? people.length) - shown.length;
  return (
    <div className={cn('flex items-center -space-x-2.5', className)}>
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} src={p.src} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface font-medium text-text-secondary ring-2 ring-surface',
            sizes[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
