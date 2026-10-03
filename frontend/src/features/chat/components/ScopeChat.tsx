import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, ConfirmDialog, EmptyState, Skeleton, toast } from '@/shared/ui';
import { MessagesSquare } from 'lucide-react';
import { chatApi, type ChatMessage } from '../api/chatApi';
import { useChatMutations, useMessages } from '../hooks/useChat';
import { useScopeChannel, type ScopeKind } from '../hooks/useScope';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import type { MessageActions } from './MessageItem';
import { useTypingListener } from '../store/typingStore';
import { ThreadPanel } from './ThreadPanel';
import { TypingIndicator } from './TypingIndicator';

/** An embeddable chat (board drawer, card drawer): same feed, composer and threads as /chat. */
export function ScopeChat({ kind, refId }: { kind: ScopeKind; refId: string }) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const { user } = useSession();
  const members = useWorkspaceMembers(workspace?.id);
  const scope = useScopeChannel(kind, refId);
  const channel = scope.data;
  const ws = workspace?.id ?? '';
  const m = useChatMutations(ws);
  const msgs = useMessages(channel?.id);
  const [threadId, setThreadId] = useState<string>();
  const [removing, setRemoving] = useState<ChatMessage | null>(null);
  const me = user?.id ?? '';
  const role = workspace?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  const readOnly = role === 'viewer';
  const onError = (e: unknown) => toast.error(errorText(e));
  useTypingListener(me);

  // New messages arriving while this panel is open count as read.
  const unread = channel?.unread ?? 0;
  const markRead = m.markRead.mutate;
  useEffect(() => {
    if (!channel || unread === 0) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) markRead(channel.id);
    }, 500);
    return () => window.clearTimeout(id);
  }, [channel, unread, markRead]);
  useEffect(() => setThreadId(undefined), [refId]);

  if (scope.isPending || !workspace) {
    return (
      <div className="space-y-3 p-4" aria-busy>
        <Skeleton className="h-10" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }
  if (scope.isError || !channel) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title={t('missing.title')}
        description={errorText(scope.error)}
        action={<Button onClick={() => void scope.refetch()}>{t('scope.retry')}</Button>}
      />
    );
  }

  const base: Omit<MessageActions, 'openThread'> = {
    react: (message, key, on) => m.react.mutate({ message, key, on }, { onError }),
    edit: (message, body) =>
      m.edit.mutateAsync({ id: message.id, body }).catch((e) => {
        onError(e);
        throw e;
      }),
    remove: (message) => setRemoving(message),
    save: (message, on) => m.save.mutate({ message, on }, { onError }),
    pin: (message, on) => m.pin.mutate({ message, on }, { onError }),
  };
  const actions: MessageActions = {
    ...base,
    openThread: (message) => setThreadId(message.parentId ?? message.id),
  };

  if (threadId) {
    return (
      <div className="h-full min-h-0">
        <ThreadPanel
          workspaceId={ws}
          channel={channel}
          rootId={threadId}
          members={members.data ?? []}
          me={me}
          canModerate={isAdmin}
          readOnly={readOnly}
          actions={base}
          onClose={() => setThreadId(undefined)}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <MessageList
        scopeKey={channel.id}
        messages={msgs.messages}
        loading={msgs.isPending}
        hasOlder={!!msgs.hasNextPage}
        loadingOlder={msgs.isFetchingNextPage}
        onLoadOlder={() => void msgs.fetchNextPage()}
        actions={actions}
        me={me}
        canModerate={isAdmin}
        readOnly={readOnly}
        empty={
          <EmptyState
            icon={<MessagesSquare />}
            title={t(kind === 'project' ? 'scope.projectEmptyTitle' : 'scope.cardEmptyTitle')}
            description={t('scope.emptyDescription')}
          />
        }
      />
      <TypingIndicator channelId={channel.id} people={members.data?.map((x) => x.user) ?? []} />
      <div className="shrink-0 px-4 pb-4">
        {readOnly ? (
          <p className="rounded-lg bg-surface-muted px-4 py-3 text-center text-sm text-text-muted">
            {t('composer.viewer')}
          </p>
        ) : (
          <Composer
            draftKey={`c:${channel.id}`}
            label={t('scope.composerLabel')}
            placeholder={t(
              kind === 'project' ? 'scope.projectPlaceholder' : 'scope.cardPlaceholder',
            )}
            members={members.data ?? []}
            hint={false}
            uploadTo={channel.id}
            onTyping={() => void chatApi.typing(channel.id).catch(() => undefined)}
            onSend={(body, fileIds) =>
              m.post.mutateAsync({ channel: channel.id, body, fileIds }).catch((e) => {
                onError(e);
                throw e;
              })
            }
          />
        )}
      </div>
      {removing !== null && (
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
      )}
    </div>
  );
}

/** The chat tab of a card. */
export function CardChat({ cardId }: { cardId: string }) {
  return <ScopeChat kind="card" refId={cardId} />;
}
