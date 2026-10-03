import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { IconButton, Skeleton } from '@/shared/ui';
import type { ChatChannel } from '../api/chatApi';
import { useChatMutations, useThread } from '../hooks/useChat';
import { Composer } from './Composer';
import { MessageItem, type MessageActions } from './MessageItem';

interface Props {
  workspaceId: string;
  channel: ChatChannel;
  rootId: string;
  members: readonly Member[];
  me: string;
  canModerate: boolean;
  readOnly: boolean;
  actions: Omit<MessageActions, 'openThread'>;
  onClose: () => void;
  onError: (e: unknown) => void;
}

/** A message and its replies in a side panel, with its own composer. */
export function ThreadPanel({
  workspaceId,
  channel,
  rootId,
  members,
  me,
  canModerate,
  readOnly,
  actions,
  onClose,
  onError,
}: Props) {
  const { t } = useTranslation('chat');
  const thread = useThread(rootId);
  const m = useChatMutations(workspaceId);
  const name = channel.name ? `#${channel.name}` : t('thread.conversation');
  const [root, ...replies] = thread.data ?? [];

  return (
    <section aria-label={t('thread.label')} className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-md font-semibold text-text">{t('thread.title')}</h2>
          <p className="truncate text-xs text-text-muted">{name}</p>
        </div>
        <IconButton label={t('thread.close')} variant="ghost" size="sm" onClick={onClose}>
          <X />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2 pt-3">
        {thread.isPending ? (
          <div className="space-y-3 px-4" aria-busy>
            <Skeleton className="h-12" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : thread.isError || !root ? (
          <p className="px-4 text-sm text-text-muted" role="alert">
            {t('thread.error')}
          </p>
        ) : (
          <>
            <ul>
              <MessageItem
                message={root}
                compact={false}
                me={me}
                canModerate={canModerate}
                readOnly={readOnly}
                actions={actions}
              />
            </ul>
            <div
              className="my-3 flex items-center gap-3 px-5 text-xs text-text-muted"
              aria-hidden={replies.length === 0}
            >
              <span>{t('thread.replies', { count: replies.length })}</span>
              <span className="h-px flex-1 bg-border-subtle" />
            </div>
            <ul>
              {replies.map((r, i) => (
                <MessageItem
                  key={r.id}
                  message={r}
                  compact={
                    i > 0 &&
                    replies[i - 1]!.author?.id === r.author?.id &&
                    new Date(r.createdAt).getTime() -
                      new Date(replies[i - 1]!.createdAt).getTime() <
                      5 * 60_000
                  }
                  me={me}
                  canModerate={canModerate}
                  readOnly={readOnly}
                  actions={actions}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      {!readOnly && (
        <div className="shrink-0 px-4 pb-4 pt-1">
          <Composer
            draftKey={`t:${rootId}`}
            focusKey={rootId}
            label={t('thread.composerLabel')}
            placeholder={t('thread.placeholder')}
            members={members}
            onSend={(body) =>
              m.post.mutateAsync({ channel: channel.id, body, parentId: rootId }).catch((e) => {
                onError(e);
                throw e;
              })
            }
          />
        </div>
      )}
    </section>
  );
}
