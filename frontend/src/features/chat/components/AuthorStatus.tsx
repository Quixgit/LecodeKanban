import { useCurrentWorkspace } from '@/features/workspaces';
import { useStatuses } from '../hooks/usePresence';
import { StatusBadge } from './PresenceDot';

/** The author's custom status icon next to their name in a message. */
export function AuthorStatus({ userId }: { userId: string }) {
  const { workspace } = useCurrentWorkspace();
  const statuses = useStatuses(workspace?.id);
  return <StatusBadge status={statuses.get(userId)} />;
}
