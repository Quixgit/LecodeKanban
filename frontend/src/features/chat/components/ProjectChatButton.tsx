import { MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, IconButton, Tooltip } from '@/shared/ui';
import { useScopeUnread } from '../hooks/useScope';
import { ScopeChat } from './ScopeChat';

/** Kanban toolbar button: opens the project's chat in a side drawer, with an unread badge. */
export function ProjectChatButton({ projectId, name }: { projectId: string; name: string }) {
  const { t } = useTranslation('chat');
  const [open, setOpen] = useState(false);
  const unread = useScopeUnread('project', projectId);
  return (
    <>
      <Tooltip content={t('scope.projectChat')}>
        <span className="relative inline-flex">
          <IconButton label={t('scope.projectChat')} onClick={() => setOpen(true)}>
            <MessagesSquare />
          </IconButton>
          {unread > 0 && (
            <span
              role="status"
              aria-label={t('sidebar.unread', { count: unread })}
              className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-2xs font-semibold tabular-nums text-white ring-2 ring-surface"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
      </Tooltip>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        width="lg"
        flush
        title={t('scope.projectChat')}
        description={name}
      >
        {open && <ScopeChat kind="project" refId={projectId} />}
      </Drawer>
    </>
  );
}
