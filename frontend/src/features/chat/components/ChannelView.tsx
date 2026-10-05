import { copyText } from '@/shared/lib/clipboard';
import { motion } from 'framer-motion';
import { ClipboardList, Hash, Info, Lock, Star, UserRound, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Button, ConfirmDialog, EmptyState, IconButton, Tooltip, toast } from '@/shared/ui';
import { chatApi, type ChatMessage } from '../api/chatApi';
import { useChannelMembers, useChatMutations, useMessages, usePins } from '../hooks/useChat';
import { useChatRules } from '../hooks/useChatRules';
import { channelTitle } from '../model/channels';
import { ChannelDetailsDialog, type DetailsTab } from './ChannelDetailsDialog';
import { ChannelTabBar, FilesPanel, PinsPanel, type ChannelTab } from './ChannelTabs';
import { Composer } from './Composer';
import { useChatContext } from './chatContext';
import type { MessageActions } from './MessageItem';
import { MessageList } from './MessageList';
import { StatusBadge } from './PresenceDot';
import { ThreadPanel } from './ThreadPanel';
import { TypingIndicator } from './TypingIndicator';

const THREAD_W = 400;

const DETAILS_TABS = ['about', 'members', 'notifications'] as const;

/** `?details=` may hold a tab, or "1" for the first tab. */
function detailsParam(v: string | null): DetailsTab | null {
  if (!v) return null;
  return (DETAILS_TABS as readonly string[]).includes(v) ? (v as DetailsTab) : 'about';
}

/** The channel name: the page's only top-level heading, or a plain heading in the second pane. */
function Heading({
  embedded,
  className,
  children,
}: {
  embedded: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return embedded ? (
    <h2 className={className}>{children}</h2>
  ) : (
    <h1 className={className}>{children}</h1>
  );
}

/** The view state of a conversation (thread, tab…): in the address bar, or in memory for the split pane. */
function useViewParams(embedded: boolean) {
  const [url, setUrl] = useSearchParams();
  const [local, setLocal] = useState(() => new URLSearchParams());
  const params = embedded ? local : url;
  const setParams = (
    next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
    options?: { replace?: boolean },
  ) => {
    if (!embedded) return setUrl(next, options);
    setLocal((prev) => (typeof next === 'function' ? next(prev) : next));
  };
  return [params, setParams] as const;
}

interface ViewProps {
  /** The conversation to show; by default the one in the address. */
  channelId?: string;
  /** Rendered in the second pane: its own view state, and a button to close it. */
  embedded?: boolean;
  onClosePane?: () => void;
}

/** One conversation: header, tabs, history, composer and the optional thread panel. */
export function ChannelView({ channelId: channelProp, embedded = false, onClosePane }: ViewProps) {
  const { allowFiles } = useChatRules();
  const { t } = useTranslation('chat');
  const routeParams = useParams();
  const channelId = channelProp ?? routeParams.channelId;
  const ctx = useChatContext();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useViewParams(embedded);
  const threadId = params.get('thread') ?? undefined;
  const highlightId = params.get('m') ?? undefined;
  const tab = (params.get('tab') as ChannelTab | null) ?? 'messages';
  const channel = ctx.channels.find((c) => c.id === channelId);
  const m = useChatMutations(ctx.workspaceId);
  const msgs = useMessages(channel?.id);
  const members = useChannelMembers(channel?.id);
  const pins = usePins(channel?.id);
  // Which tab of the details window is open (null: closed). The sidebar menu opens it with ?details=<tab>.
  const [details, setDetails] = useState<DetailsTab | null>(() =>
    detailsParam(params.get('details')),
  );
  const [removing, setRemoving] = useState<ChatMessage | null>(null);

  // A link from the sidebar menu opens the details; drop the flag so it doesn't reopen on reload.
  const wantsDetails = params.get('details');
  useEffect(() => {
    if (!wantsDetails) return;
    setDetails(detailsParam(wantsDetails) ?? 'about');
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('details');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsDetails]);

  // Opening a conversation (and every message that arrives while it is on screen) marks it read.
  const unread = channel?.unread ?? 0;
  const joined = channel?.joined ?? false;
  const markRead = m.markRead.mutate;
  useEffect(() => {
    if (!channel || !joined || unread === 0) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) markRead(channel.id);
    }, 500);
    return () => window.clearTimeout(id);
  }, [channel, joined, unread, markRead]);

  useEffect(() => {
    if (!highlightId || msgs.messages.length === 0) return;
    document
      .querySelector(`[data-message-id="${highlightId}"]`)
      ?.scrollIntoView({ block: 'center' });
  }, [highlightId, msgs.messages.length]);

  if (ctx.channelsLoading) return <div className="min-h-[24rem]" aria-busy />;
  if (!channel) {
    return (
      <EmptyState
        icon={<Hash />}
        title={t('missing.title')}
        description={t('missing.description')}
        action={
          <Button onClick={() => (embedded ? onClosePane?.() : navigate('/chat'))}>
            {t('missing.back')}
          </Button>
        }
      />
    );
  }

  const title = channelTitle(channel, ctx.me, t('list.you'));
  const readOnly = !ctx.canWrite;
  const onError = (e: unknown) => toast.error(errorText(e));
  const edit = (patch: (p: URLSearchParams) => void) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      patch(next);
      return next;
    });
  const openThread = (message: ChatMessage) =>
    edit((n) => {
      n.set('thread', message.parentId ?? message.id);
      n.delete('tab');
    });
  const closeThread = () => edit((n) => n.delete('thread'));
  const setTab = (next: ChannelTab) =>
    edit((n) => {
      if (next === 'messages') n.delete('tab');
      else n.set('tab', next);
    });

  const base: Omit<MessageActions, 'openThread'> = {
    react: (message, key, on) => m.react.mutate({ message, key, on }, { onError }),
    edit: (message, body) =>
      m.edit.mutateAsync({ id: message.id, body }).catch((e) => {
        onError(e);
        throw e;
      }),
    remove: (message) => setRemoving(message),
    save: (message, on) => m.save.mutate({ message, on }, { onError }),
    pin: (message, on) =>
      m.pin.mutate(
        { message, on },
        {
          onError,
          onSuccess: () => toast.success(t(on ? 'message.pinnedToast' : 'message.unpinnedToast')),
        },
      ),
    copyLink: (message) => {
      const url = `${window.location.origin}/chat/${channel.id}?m=${message.id}`;
      void copyText(url).then((ok) =>
        ok ? toast.success(t('message.linkCopied')) : toast.error(t('message.linkCopyFailed')),
      );
    },
  };
  const actions: MessageActions = { ...base, openThread };

  const others = channel.people.filter((p) => p.id !== ctx.me);
  const Icon = channel.feed
    ? ClipboardList
    : channel.kind === 'public'
      ? Hash
      : channel.kind === 'private'
        ? Lock
        : channel.people.length > 2
          ? Users
          : UserRound;
  const showThread = !!threadId;
  const roster = members.data ?? channel.people;
  const dmPeer = channel.kind === 'dm' && others.length === 1 ? others[0] : undefined;

  return (
    <div className="flex min-h-0 flex-1">
      {(desktop || !showThread) && (
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 px-5">
            <Icon className="size-5 shrink-0 stroke-[1.6] text-text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <Heading
                embedded={embedded}
                className="flex items-center gap-2 truncate text-md font-semibold text-text"
              >
                {title}
                {dmPeer && <StatusBadge status={ctx.statuses.get(dmPeer.id)} />}
                {channel.feed && (
                  <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary-ink">
                    {t('feed.badge')}
                  </span>
                )}
              </Heading>
              {channel.topic && (
                <button
                  type="button"
                  onClick={() => setDetails('about')}
                  className="block max-w-full truncate text-left text-xs text-text-muted hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
                >
                  {channel.topic}
                </button>
              )}
            </div>
            <Tooltip content={channel.starred ? t('header.unstar') : t('header.star')}>
              <IconButton
                label={channel.starred ? t('header.unstar') : t('header.star')}
                variant="ghost"
                size="sm"
                aria-pressed={channel.starred}
                onClick={() => m.star.mutate({ id: channel.id, on: !channel.starred }, { onError })}
              >
                <Star className={cn(channel.starred && 'fill-warning text-warning')} />
              </IconButton>
            </Tooltip>
            <Tooltip content={t('header.details')}>
              <button
                type="button"
                onClick={() => setDetails('about')}
                aria-label={t('header.details')}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-text-secondary outline-none transition-colors duration-micro hover:border-border-strong hover:bg-surface-muted focus-visible:shadow-focus"
              >
                {channel.kind === 'dm' ? (
                  <Info className="size-4" aria-hidden />
                ) : (
                  <>
                    <Users className="size-4" aria-hidden />
                    <span className="tabular-nums">{channel.memberCount}</span>
                  </>
                )}
              </button>
            </Tooltip>
            {embedded && onClosePane && (
              <Tooltip content={t('split.close')}>
                <IconButton
                  label={t('split.close')}
                  variant="ghost"
                  size="sm"
                  onClick={onClosePane}
                >
                  <X />
                </IconButton>
              </Tooltip>
            )}
          </header>
          <ChannelTabBar value={tab} onChange={setTab} pinCount={pins.data?.length} />

          {tab === 'pins' ? (
            <PinsPanel
              channel={channel}
              me={ctx.me}
              canModerate={ctx.isAdmin}
              readOnly={readOnly}
              actions={actions}
            />
          ) : tab === 'files' ? (
            <FilesPanel channel={channel} />
          ) : (
            <>
              <MessageList
                scopeKey={channel.id}
                messages={msgs.messages}
                loading={msgs.isPending}
                hasOlder={!!msgs.hasNextPage}
                loadingOlder={msgs.isFetchingNextPage}
                onLoadOlder={() => void msgs.fetchNextPage()}
                actions={actions}
                me={ctx.me}
                canModerate={ctx.isAdmin}
                readOnly={readOnly}
                highlightId={highlightId}
                empty={
                  <EmptyState
                    icon={<Icon />}
                    title={
                      channel.feed
                        ? t('feed.emptyFeedTitle')
                        : t('feed.emptyTitle', { name: title })
                    }
                    description={
                      channel.feed
                        ? t('feed.emptyFeedDescription')
                        : channel.kind === 'dm'
                          ? t('feed.emptyDirect')
                          : t('feed.emptyChannel')
                    }
                  />
                }
              />
              <TypingIndicator channelId={channel.id} people={roster} />
              <div className="shrink-0 px-5 pb-4">
                {readOnly ? (
                  <p className="rounded-lg bg-surface-muted px-4 py-3 text-center text-sm text-text-muted">
                    {t('composer.viewer')}
                  </p>
                ) : channel.feed ? (
                  <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-text-secondary">
                    <ClipboardList className="size-4 shrink-0 text-primary-ink" aria-hidden />
                    {t('feed.readonly')}
                  </p>
                ) : !channel.joined ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3">
                    <p className="text-sm text-text-secondary">
                      {t('composer.preview', { name: title })}
                    </p>
                    <Button
                      size="sm"
                      loading={m.join.isPending}
                      onClick={() => m.join.mutate(channel.id, { onError })}
                    >
                      {t('browse.join')}
                    </Button>
                  </div>
                ) : (
                  <Composer
                    draftKey={`c:${channel.id}`}
                    label={t('composer.label', { name: channel.name ? `#${title}` : title })}
                    placeholder={t('composer.placeholder', {
                      name: channel.name ? `#${title}` : title,
                    })}
                    members={ctx.members}
                    uploadTo={allowFiles ? channel.id : undefined}
                    broadcast={channel.kind !== 'dm'}
                    onTyping={() => void chatApi.typing(channel.id).catch(() => undefined)}
                    hint={!showThread}
                    autoFocus
                    onSend={(body, fileIds) =>
                      m.post.mutateAsync({ channel: channel.id, body, fileIds }).catch((e) => {
                        onError(e);
                        throw e;
                      })
                    }
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {showThread && desktop && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: THREAD_W, opacity: 1 }}
          transition={transition.large}
          className="shrink-0 overflow-hidden border-l border-border-subtle"
        >
          <div style={{ width: THREAD_W }} className="h-full">
            <ThreadPanel
              workspaceId={ctx.workspaceId}
              channel={channel}
              rootId={threadId}
              members={ctx.members}
              me={ctx.me}
              canModerate={ctx.isAdmin}
              readOnly={readOnly}
              actions={base}
              onClose={closeThread}
              onError={onError}
            />
          </div>
        </motion.aside>
      )}
      {showThread && !desktop && (
        <div className="min-w-0 flex-1">
          <ThreadPanel
            workspaceId={ctx.workspaceId}
            channel={channel}
            rootId={threadId}
            members={ctx.members}
            me={ctx.me}
            canModerate={ctx.isAdmin}
            readOnly={readOnly}
            actions={base}
            onClose={closeThread}
            onError={onError}
          />
        </div>
      )}

      <ChannelDetailsDialog
        open={details !== null}
        initialTab={details ?? 'about'}
        onOpenChange={(o) => !o && setDetails(null)}
        workspaceId={ctx.workspaceId}
        channel={channel}
        me={ctx.me}
        members={ctx.members}
        isAdmin={ctx.isAdmin}
        canWrite={ctx.canWrite}
        online={ctx.online}
        projects={ctx.projects}
        onGone={() => (embedded ? onClosePane?.() : navigate('/chat'))}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('message.deleteTitle')}
        description={t('message.deleteBody')}
        confirmLabel={t('message.delete')}
        loading={m.remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          m.remove.mutate(removing, { onError, onSettled: () => setRemoving(null) });
        }}
      />
    </div>
  );
}
