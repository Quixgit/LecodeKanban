import { Smile } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui';
import { useStatuses } from '../hooks/usePresence';
import { STATUS_ICONS } from '../model/status';
import { PersonAvatar } from './PresenceDot';
import { StatusDialog } from './StatusDialog';

/** Your own status chip: shows what others see and opens the status dialog. */
export function MyStatus({ workspaceId, className }: { workspaceId: string; className?: string }) {
  const { t } = useTranslation('chat');
  const { user } = useSession();
  const statuses = useStatuses(workspaceId);
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const mine = statuses.get(user.id);
  const Icon = mine?.icon ? STATUS_ICONS[mine.icon] : Smile;
  const label = mine?.text || (mine ? t(`status.kinds.${mine.kind}`) : t('status.set'));
  return (
    <>
      <Tooltip content={t('status.set')}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('status.setNamed', { status: label })}
          className={cn(
            'flex h-8 max-w-44 items-center gap-1.5 rounded-lg border border-transparent pl-1 pr-2 text-xs text-text-secondary outline-none transition-colors duration-micro hover:border-border hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40',
            className,
          )}
        >
          <PersonAvatar name={user.name} src={user.avatarUrl} online status={mine} size="xs" />
          <Icon className="size-3.5 shrink-0 stroke-[1.7] text-text-muted" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </Tooltip>
      <StatusDialog open={open} onOpenChange={setOpen} workspaceId={workspaceId} current={mine} />
    </>
  );
}
