import { cn } from '@/shared/lib/cn';
import { visibilityIcon } from '../model/visibilityIcon';
import type { WikiVisibility } from '../model/tree';

/** Lock / people / globe for the effective visibility of a space or node. */
export function VisibilityIcon({
  visibility,
  className,
}: {
  visibility: WikiVisibility;
  className?: string;
}) {
  const Icon = visibilityIcon[visibility];
  return <Icon className={cn('size-3.5 stroke-[1.6]', className)} aria-hidden />;
}
