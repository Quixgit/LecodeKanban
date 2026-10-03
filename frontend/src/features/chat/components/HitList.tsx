import { Bookmark, MessagesSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router-dom';
import { Avatar, EmptyState, Skeleton } from '@/shared/ui';
import type { ChatHit } from '../api/chatApi';
import { channelTitle } from '../model/channels';
import { useMyThreads, useSavedMessages } from '../hooks/useChat';
import type { ChatOutletContext } from './ChatLayout';
import { hitUrl } from '../model/hits';
import { ChannelGlyph } from './SearchDialog';

function Hits({
  hits,
  loading,
  title,
  empty,
  showReplies,
}: {
  hits: readonly ChatHit[] | undefined;
  loading: boolean;
  title: string;
  empty: { icon: React.ReactNode; title: string; description: string };
  showReplies?: boolean;
}) {
  const { t, i18n } = useTranslation('chat');
  const ctx = useOutletContext<ChatOutletContext>();
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section aria-label={title} className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-border-subtle px-5">
        <h1 className="text-md font-semibold text-text">{title}</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !hits || hits.length === 0 ? (
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
        ) : (
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.message.id}>
                <Link
                  to={showReplies ? `/chat/${h.channel.id}?thread=${h.message.id}` : hitUrl(h)}
                  className="block rounded-xl border border-border-subtle bg-surface p-3.5 shadow-xs outline-none transition-[border-color,box-shadow] duration-micro hover:border-border-strong hover:shadow-md focus-visible:shadow-focus"
                >
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                    <ChannelGlyph c={h.channel} />
                    <span className="font-medium text-text-secondary">
                      {channelTitle(h.channel, ctx.me, t('list.you'))}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={h.message.createdAt}>
                      {fmt.format(new Date(h.message.createdAt))}
                    </time>
                  </span>
                  <span className="flex items-start gap-3">
                    <Avatar
                      name={h.message.author?.name ?? '?'}
                      src={h.message.author?.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-text">
                        {h.message.author?.name ?? t('message.unknownAuthor')}
                      </span>
                      <span className="line-clamp-3 block text-base text-text">
                        {h.message.body.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1') ||
                          t('threads.attachment')}
                      </span>
                      {showReplies && h.message.replyCount > 0 && (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary-ink">
                          <MessagesSquare className="size-3.5" aria-hidden />
                          {t('message.replies', { count: h.message.replyCount })}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Every thread the caller started or replied in. */
export function ThreadsView() {
  const { t } = useTranslation('chat');
  const ctx = useOutletContext<ChatOutletContext>();
  const q = useMyThreads(ctx.workspaceId);
  return (
    <Hits
      hits={q.data}
      loading={q.isPending}
      title={t('threads.title')}
      showReplies
      empty={{
        icon: <MessagesSquare />,
        title: t('threads.emptyTitle'),
        description: t('threads.emptyDescription'),
      }}
    />
  );
}

/** The caller's saved ("Later") messages. */
export function SavedView() {
  const { t } = useTranslation('chat');
  const ctx = useOutletContext<ChatOutletContext>();
  const q = useSavedMessages(ctx.workspaceId);
  return (
    <Hits
      hits={q.data}
      loading={q.isPending}
      title={t('saved.title')}
      empty={{
        icon: <Bookmark />,
        title: t('saved.emptyTitle'),
        description: t('saved.emptyDescription'),
      }}
    />
  );
}
