import { cn } from '@/shared/lib/cn';
import { WORKSPACE_ICONS, type WorkspaceIcon } from '../model/workspaceLook';

const SIZES = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-5',
  lg: 'size-14 [&_svg]:size-7',
};

/** The workspace's icon in a tile of its accent colour. */
export function WorkspaceGlyph({
  icon,
  size = 'md',
  className,
}: {
  icon: WorkspaceIcon;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = WORKSPACE_ICONS[icon] ?? WORKSPACE_ICONS.building;
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-primary-solid text-on-primary shadow-primary',
        SIZES[size],
        className,
      )}
    >
      <Icon className="stroke-[1.6]" />
    </span>
  );
}
