import { MessagesSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { EmptyState } from '@/shared/ui';
import type { Member } from '@/shared/api';
import type { ChatChannel } from '../api/chatApi';
import { useChannels } from '../hooks/useChat';
import { useChatUiStore } from '../store/chatUiStore';
import { BrowseChannelsDialog, CreateChannelDialog, NewMessageDialog } from './ChannelDialogs';
import { ChannelList } from './ChannelList';

export interface ChatOutletContext {
  workspaceId: string;
  channels: readonly ChatChannel[];
  channelsLoading: boolean;
  members: readonly Member[];
  me: string;
  isAdmin: boolean;
  canWrite: boolean;
  openBrowse: () => void;
  openCreate: () => void;
}

/** Chat shell: channel list on the left, the open conversation (and its thread) on the right. */
export function ChatLayout() {
  const { t } = useTranslation('chat');
  const navigate = useNavigate();
  const { workspace, isLoading } = useCurrentWorkspace();
  const ws = workspace?.id;
  const { user } = useSession();
  const channels = useChannels(ws);
  const members = useWorkspaceMembers(ws);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const match = useMatch('/chat/:channelId');
  const activeId = match?.params.channelId;
  const setLast = useChatUiStore((s) => s.setLastChannel);
  const [dialog, setDialog] = useState<'create' | 'browse' | 'direct' | null>(null);

  const me = user?.id ?? '';
  useEffect(() => {
    if (me && activeId) setLast(me, activeId);
  }, [me, activeId, setLast]);

  if (isLoading || !workspace) return <div className="min-h-[24rem]" aria-busy />;

  const role = workspace.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const canWrite = role !== 'viewer';
  const list = channels.data ?? [];
  const open = (c: ChatChannel) => navigate(`/chat/${c.id}`);
  const context: ChatOutletContext = {
    workspaceId: workspace.id,
    channels: list,
    channelsLoading: channels.isPending,
    members: members.data ?? [],
    me,
    isAdmin,
    canWrite,
    openBrowse: () => setDialog('browse'),
    openCreate: () => setDialog('create'),
  };
  // Below lg the list and the conversation take turns.
  const showList = desktop || !activeId;
  const showMain = desktop || !!activeId;

  return (
    <div className="flex h-[calc(100dvh-var(--header-h)-3rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm">
      {showList && (
        <aside
          aria-label={t('sidebar.title')}
          className="flex w-full shrink-0 flex-col border-r border-border-subtle bg-surface lg:w-72"
        >
          <div className="flex h-11 items-center gap-2 px-4 pt-1">
            <MessagesSquare className="size-4 stroke-[1.6] text-primary-ink" aria-hidden />
            <h2 className="text-md font-semibold text-text">{t('sidebar.title')}</h2>
          </div>
          <div className="min-h-0 flex-1">
            <ChannelList
              channels={channels.data}
              loading={channels.isPending}
              me={me}
              activeId={activeId}
              canCreate={canWrite}
              onCreate={() => setDialog('create')}
              onBrowse={() => setDialog('browse')}
              onNewMessage={() => setDialog('direct')}
            />
          </div>
        </aside>
      )}
      {showMain && (
        <div className="flex min-w-0 flex-1 flex-col">
          {!desktop && (
            <Link
              to="/chat"
              className="m-3 inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus focus-visible:outline-none"
            >
              <MessagesSquare className="size-4" aria-hidden />
              {t('sidebar.title')}
            </Link>
          )}
          <Outlet context={context} />
        </div>
      )}

      <CreateChannelDialog
        open={dialog === 'create'}
        onOpenChange={(o) => !o && setDialog(null)}
        workspaceId={workspace.id}
        onCreated={open}
      />
      <NewMessageDialog
        open={dialog === 'direct'}
        onOpenChange={(o) => !o && setDialog(null)}
        workspaceId={workspace.id}
        members={context.members}
        me={me}
        onOpened={open}
      />
      <BrowseChannelsDialog
        open={dialog === 'browse'}
        onOpenChange={(o) => !o && setDialog(null)}
        workspaceId={workspace.id}
        channels={list}
        me={me}
        onOpen={open}
      />
    </div>
  );
}

export function NoChannels({
  onCreate,
  onBrowse,
  canCreate,
}: {
  onCreate: () => void;
  onBrowse: () => void;
  canCreate: boolean;
}) {
  const { t } = useTranslation('chat');
  return (
    <EmptyState
      icon={<MessagesSquare />}
      title={t('empty.title')}
      description={t('empty.description')}
      action={
        <div className="flex gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-control items-center rounded-lg bg-primary-solid px-4 text-base font-medium text-on-primary shadow-primary hover:bg-primary-solid-hover focus-visible:shadow-focus focus-visible:outline-none"
            >
              {t('sidebar.create')}
            </button>
          )}
          <button
            type="button"
            onClick={onBrowse}
            className="inline-flex h-control items-center rounded-lg border border-border bg-surface px-4 text-base font-medium text-text shadow-xs hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
          >
            {t('sidebar.browse')}
          </button>
        </div>
      }
    />
  );
}
