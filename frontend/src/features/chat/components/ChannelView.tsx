import { motion } from 'framer-motion';
import { Hash, Info, Lock, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { transition } from '@/shared/motion';
import {
  Avatar,
  AvatarGroup,
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Tooltip,
  toast,
} from '@/shared/ui';
import type { ChatMessage } from '../api/chatApi';
import { useChannelMembers, useChatMutations, useMessages } from '../hooks/useChat';
import { channelTitle } from '../model/channels';
import { ChannelDetailsDialog } from './ChannelDetailsDialog';
import { Composer } from './Composer';
import type { ChatOutletContext } from './ChatLayout';
import type { MessageActions } from './MessageItem';
import { MessageList } from './MessageList';
import { ThreadPanel } from './ThreadPanel';

const THREAD_W = 400;

/** One conversation: header, history, composer and the optional thread panel. */
export function ChannelView() {
  const { t } = useTranslation('chat');
  const { channelId } = useParams();
  const ctx = useOutletContext<ChatOutletContext>();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [params, setParams] = useSearchParams();
  const threadId = params.get('thread') ?? undefined;
  const highlightId = params.get('m') ?? undefined;
  const channel = ctx.channels.find((c) => c.id === channelId);
  const m = useChatMutations(ctx.workspaceId);
  const msgs = useMessages(channel?.id);
  const members = useChannelMembers(channel?.id);
  const [details, setDetails] = useState(false);
  const [removing, setRemoving] = useState<ChatMessage | null>(null);

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
        action={<Button onClick={() => navigate('/chat')}>{t('missing.back')}</Button>}
      />
    );
  }

  const title = channelTitle(channel, ctx.me, t('list.you'));
  const readOnly = !ctx.canWrite;
  const onError = (e: unknown) => toast.error(errorText(e));
  const openThread = (message: ChatMessage) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('thread', message.parentId ?? message.id);
      return next;
    });
  const closeThread = () =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete('thread');
      return next;
    });

  const base: Omit<MessageActions, 'openThread'> = {
    react: (message, key, on) => m.react.mutate({ message, key, on }, { onError }),
    edit: (message, body) =>
      m.edit.mutateAsync({ id: message.id, body }).catch((e) => {
        onError(e);
        throw e;
      }),
    remove: (message) => setRemoving(message),
    copyLink: (message) => {
      const url = `${window.location.origin}/chat/${channel.id}?m=${message.id}`;
      void navigator.clipboard?.writeText(url).then(() => toast.success(t('message.linkCopied')));
    },
  };
  const actions: MessageActions = { ...base, openThread };

  const others = channel.people.filter((p) => p.id !== ctx.me);
  const Icon =
    channel.kind === 'public'
      ? Hash
      : channel.kind === 'private'
        ? Lock
        : channel.people.length > 2
          ? Users
          : UserRound;
  const showThread = !!threadId;

  return (
    <div className="flex min-h-0 flex-1">
      {(desktop || !showThread) && (
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-5">
            {channel.kind === 'dm' && others.length === 1 ? (
              <Avatar name={others[0]!.name} src={others[0]!.avatarUrl} size="sm" />
            ) : (
              <Icon className="size-5 shrink-0 stroke-[1.6] text-text-muted" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-md font-semibold text-text">{title}</h1>
              {channel.topic && (
                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="block max-w-full truncate text-left text-xs text-text-muted hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
                >
                  {channel.topic}
                </button>
              )}
            </div>
            <Tooltip content={t('header.members')}>
              <button
                type="button"
                onClick={() => setDetails(true)}
                aria-label={t('header.members')}
                className="hidden items-center gap-2 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary outline-none transition-colors duration-micro hover:border-border-strong hover:bg-surface-muted focus-visible:shadow-focus sm:flex"
              >
                <AvatarGroup
                  size="xs"
                  max={3}
                  total={channel.memberCount}
                  people={(members.data ?? channel.people).map((p) => ({
                    name: p.name,
                    src: p.avatarUrl,
                  }))}
                />
                <span className="tabular-nums">{channel.memberCount}</span>
              </button>
            </Tooltip>
            <Tooltip content={t('header.details')}>
              <IconButton
                label={t('header.details')}
                variant="ghost"
                size="sm"
                onClick={() => setDetails(true)}
              >
                <Info />
              </IconButton>
            </Tooltip>
          </header>

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
                title={t('feed.emptyTitle', { name: title })}
                description={channel.kind === 'dm' ? t('feed.emptyDirect') : t('feed.emptyChannel')}
              />
            }
          />

          <div className="shrink-0 px-5 pb-4 pt-1">
            {readOnly ? (
              <p className="rounded-lg bg-surface-muted px-4 py-3 text-center text-sm text-text-muted">
                {t('composer.viewer')}
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
                hint={!showThread}
                autoFocus
                onSend={(body) =>
                  m.post.mutateAsync({ channel: channel.id, body }).catch((e) => {
                    onError(e);
                    throw e;
                  })
                }
              />
            )}
          </div>
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
        open={details}
        onOpenChange={setDetails}
        workspaceId={ctx.workspaceId}
        channel={channel}
        me={ctx.me}
        members={ctx.members}
        isAdmin={ctx.isAdmin}
        canWrite={ctx.canWrite}
        onGone={() => navigate('/chat')}
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
