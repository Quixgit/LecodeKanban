import { MessagesSquare, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useMatch, useNavigate } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useRailSlot } from '@/shared/lib/shellLayout';
import { cn } from '@/shared/lib/cn';
import { EmptyState, IconButton, Tooltip } from '@/shared/ui';
import type { Member } from '@/shared/api';
import type { ChatChannel, ChatStatus } from '../api/chatApi';
import { useChannels } from '../hooks/useChat';
import { useOnline, useStatuses } from '../hooks/usePresence';
import { accentVars, sidebarVars } from '../model/theme';
import { useChatThemeStore } from '../store/chatThemeStore';
import { ChatAppearanceDialog } from './ChatAppearanceDialog';
import { MyStatus } from './MyStatus';
import { useChatUiStore } from '../store/chatUiStore';
import { useTypingListener } from '../store/typingStore';
import { SearchDialog } from './SearchDialog';
import {
  BrowseChannelsDialog,
  CreateChannelDialog,
  NewMessageDialog,
  type FeedProject,
} from './ChannelDialogs';
import { ChannelList } from './ChannelList';
import { ChannelView } from './ChannelView';
import { ChatContext } from './chatContext';

export interface ChatOutletContext {
  workspaceId: string;
  channels: readonly ChatChannel[];
  channelsLoading: boolean;
  members: readonly Member[];
  projects: readonly FeedProject[];
  me: string;
  isAdmin: boolean;
  canWrite: boolean;
  online: ReadonlySet<string>;
  statuses: ReadonlyMap<string, ChatStatus>;
  openBrowse: () => void;
  openCreate: () => void;
  openSearch: () => void;
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
  const projects = useAllProjects(ws);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const rail = useRailSlot(desktop);
  const match = useMatch('/chat/:channelId');
  const activeId = match?.params.channelId;
  const setLast = useChatUiStore((s) => s.setLastChannel);
  const [dialog, setDialog] = useState<'create' | 'browse' | 'direct' | 'search' | null>(null);
  const [looks, setLooks] = useState(false);
  const sidebarColour = useChatThemeStore((s) => s.sidebar);
  const accentColour = useChatThemeStore((s) => s.accent);
  const theme = { sidebar: sidebarColour, accent: accentColour };
  // A second conversation shown next to the open one ("Open in split view").
  const [split, setSplit] = useState<string | null>(null);
  const [searchSeed, setSearchSeed] = useState('');
  const online = useOnline(ws);
  const statuses = useStatuses(ws);

  const me = user?.id ?? '';
  useTypingListener(me);
  useEffect(() => {
    if (me && activeId) setLast(me, activeId);
  }, [me, activeId, setLast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setDialog('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (isLoading || !workspace) return <div className="min-h-[24rem]" aria-busy />;

  const isAdmin = can(workspace, 'chat.moderate');
  const canWrite = can(workspace, 'content.edit');
  const list = channels.data ?? [];
  const open = (c: ChatChannel) => navigate(`/chat/${c.id}`);
  const context: ChatOutletContext = {
    workspaceId: workspace.id,
    channels: list,
    channelsLoading: channels.isPending,
    members: members.data ?? [],
    projects: (projects.data?.items ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name })),
    me,
    isAdmin,
    canWrite,
    online,
    statuses,
    openBrowse: () => setDialog('browse'),
    openCreate: () => setDialog('create'),
    openSearch: () => setDialog('search'),
  };
  // Below lg the list and the conversation take turns.
  const showList = desktop || !activeId;
  const showMain = desktop || !!activeId;

  const channelPanel = (
    <aside
      aria-label={t('sidebar.title')}
      style={sidebarVars(theme)}
      className={cn(
        'flex shrink-0 flex-col bg-surface text-text transition-colors duration-ui',
        rail.railed ? 'h-full w-full' : 'w-full border-r border-border-subtle lg:w-72',
      )}
    >
      <div className="flex h-11 items-center gap-2 px-4 pt-1">
        <MessagesSquare className="size-4 stroke-[1.6] text-primary-ink" aria-hidden />
        <h2 className="text-md font-semibold text-text">{t('sidebar.title')}</h2>
        <span className="ml-auto flex items-center gap-1">
          <Tooltip content={t('appearance.open')}>
            <IconButton
              label={t('appearance.open')}
              variant="ghost"
              size="sm"
              onClick={() => setLooks(true)}
            >
              <Palette />
            </IconButton>
          </Tooltip>
          <MyStatus workspaceId={workspace.id} />
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <ChannelList
          channels={channels.data}
          loading={channels.isPending}
          me={me}
          workspaceId={ws ?? ''}
          activeId={activeId}
          canCreate={canWrite}
          onCreate={() => setDialog('create')}
          onBrowse={() => setDialog('browse')}
          online={online}
          statuses={statuses}
          onSearch={() => setDialog('search')}
          onNewMessage={() => setDialog('direct')}
          onSplit={desktop ? (id) => setSplit(id === activeId ? null : id) : undefined}
          onSearchIn={(ch) => {
            setSearchSeed(ch.name ? `in:#${ch.name} ` : '');
            setDialog('search');
          }}
        />
      </div>
    </aside>
  );

  return (
    <ChatContext.Provider value={context}>
      <div
        style={accentVars(theme)}
        className="flex h-[calc(100dvh-var(--header-h)-3rem)] min-h-[30rem] overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm"
      >
        {showList && !rail.railed && channelPanel}
        {rail.target && createPortal(channelPanel, rail.target)}
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
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <Outlet context={context} />
              </div>
              {split && desktop && (
                <section
                  aria-label={t('split.label')}
                  className="flex min-w-0 flex-1 flex-col border-l border-border-subtle"
                >
                  <ChannelView embedded channelId={split} onClosePane={() => setSplit(null)} />
                </section>
              )}
            </div>
          </div>
        )}

        <CreateChannelDialog
          open={dialog === 'create'}
          onOpenChange={(o) => !o && setDialog(null)}
          workspaceId={workspace.id}
          members={context.members}
          projects={context.projects}
          me={me}
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
        <ChatAppearanceDialog open={looks} onOpenChange={setLooks} />
        <SearchDialog
          open={dialog === 'search'}
          onOpenChange={(o) => !o && setDialog(null)}
          workspaceId={workspace.id}
          me={me}
          meName={user?.name ?? ''}
          channels={list}
          members={context.members}
          activeId={activeId}
          initialText={searchSeed}
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
    </ChatContext.Provider>
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
