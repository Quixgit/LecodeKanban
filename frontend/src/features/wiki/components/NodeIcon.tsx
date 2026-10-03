import { FileText, Folder } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { iconFor } from '../model/icons';
import type { WikiNode } from '../model/tree';

/** The node's icon (a Lucide key) or a folder / document glyph. */
export function NodeIcon({
  node,
  className,
}: {
  node: Pick<WikiNode, 'icon' | 'kind'>;
  className?: string;
}) {
  const Icon = iconFor(node.icon) ?? (node.kind === 'folder' ? Folder : FileText);
  return (
    <Icon
      aria-hidden
      className={cn('size-[18px] shrink-0 stroke-[1.6] text-text-muted', className)}
    />
  );
}
