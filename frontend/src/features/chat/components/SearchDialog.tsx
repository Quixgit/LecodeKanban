import { Hash, Lock, MessagesSquare, Search, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Avatar, Input, Modal, Skeleton } from '@/shared/ui';
import type { ChatChannel } from '../api/chatApi';
import { useMessageSearch } from '../hooks/useChat';
import { channelTitle } from '../model/channels';
import { hitUrl } from '../model/hits';

export function ChannelGlyph({ c }: { c: ChatChannel }) {
  const Icon =
    c.kind === 'public'
      ? Hash
      : c.kind === 'private'
        ? Lock
        : c.people.length > 2
          ? Users
          : UserRound;
  return <Icon className="size-3.5 shrink-0 text-text-muted" aria-hidden />;
}

/** Highlights the first match of the query in a snippet around it. */
export function Snippet({ text, q }: { text: string; q: string }) {
  const flat = text.replace(/@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi, '@$1').replace(/\s+/g, ' ');
  const i = q ? flat.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{flat.slice(0, 200)}</>;
  const start = Math.max(0, i - 40);
  return (
    <>
      {start > 0 && '…'}
      {flat.slice(start, i)}
      <mark className="bg-warning/30 rounded px-0.5 text-text">{flat.slice(i, i + q.length)}</mark>
      {flat.slice(i + q.length, i + q.length + 140)}
    </>
  );
}

/** Message search across every conversation the caller can see. */
export function SearchDialog({
  open,
  onOpenChange,
  workspaceId,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  me: string;
}) {
  return open ? (
    <Search_ open={open} onOpenChange={onOpenChange} workspaceId={workspaceId} me={me} />
  ) : null;
}

function Search_({
  open,
  onOpenChange,
  workspaceId,
  me,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  me: string;
}) {
  const { t, i18n } = useTranslation('chat');
  const navigate = useNavigate();
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setQ(raw.trim()), 250);
    return () => window.clearTimeout(id);
  }, [raw]);
  const search = useMessageSearch(workspaceId, q);
  // Project and card conversations have no page in the channel list, so they are left out here.
  const hits = (search.data ?? []).filter((h) =>
    ['public', 'private', 'dm'].includes(h.channel.kind),
  );
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('search.title')}
      description={t('search.description')}
    >
      <div className="flex flex-col gap-3">
        <Input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          leadingIcon={<Search />}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
        />
        <div className="max-h-[26rem] min-h-24 overflow-y-auto" aria-live="polite">
          {q.length < 2 ? (
            <p className="px-2 py-6 text-center text-sm text-text-muted">{t('search.hint')}</p>
          ) : search.isPending ? (
            <div className="space-y-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : hits.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-text-muted">
              <MessagesSquare className="size-6" aria-hidden />
              <p className="text-sm">{t('search.none', { q })}</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {hits.map((h) => (
                <li key={h.message.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(hitUrl(h));
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:shadow-focus"
                  >
                    <Avatar
                      name={h.message.author?.name ?? '?'}
                      src={h.message.author?.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs text-text-muted">
                        <ChannelGlyph c={h.channel} />
                        <span className="truncate font-medium text-text-secondary">
                          {channelTitle(h.channel, me, t('list.you'))}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {h.message.author?.name ?? t('message.unknownAuthor')}
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={h.message.createdAt}>
                          {fmt.format(new Date(h.message.createdAt))}
                        </time>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-base text-text">
                        <Snippet text={h.message.body} q={q} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
