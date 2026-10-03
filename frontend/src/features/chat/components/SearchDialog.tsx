import {
  AtSign,
  CalendarDays,
  Check,
  File as FileIcon,
  Hash,
  Link as LinkIcon,
  Lock,
  MessagesSquare,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Member } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import {
  Avatar,
  Dropdown,
  DropdownContent,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownTrigger,
  Modal,
  Skeleton,
} from '@/shared/ui';
import type { ChatChannel, SearchParams } from '../api/chatApi';
import { useChatMutations, useMessageSearch } from '../hooks/useChat';
import { channelTitle } from '../model/channels';
import { hitUrl } from '../model/hits';
import {
  hasAnyFilter,
  parseQuery,
  rangeStart,
  suggest,
  type DateRange,
  type SearchFilters,
} from '../model/searchQuery';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  me: string;
  meName: string;
  channels: readonly ChatChannel[];
  members: readonly Member[];
  /** The conversation on screen: offers the "In this conversation" chip. */
  activeId?: string;
}

/** Slack-style search: one box for every conversation, with modifiers, chips and jump-to results. */
export function SearchDialog(props: Props) {
  return props.open ? <SearchBody {...props} /> : null;
}

function SearchBody({
  open,
  onOpenChange,
  workspaceId,
  me,
  meName,
  channels,
  members,
  activeId,
}: Props) {
  const { t, i18n } = useTranslation('chat');
  const navigate = useNavigate();
  const m = useChatMutations(workspaceId);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [debounced, setDebounced] = useState('');
  const [highlight, setHighlight] = useState(0);
  const people = useMemo(
    () => members.map((x) => ({ id: x.user.id, name: x.user.name })),
    [members],
  );
  const you = t('list.you');
  const active = channels.find((c) => c.id === activeId);

  // Complete modifiers typed in the box become chips; a half-typed one offers suggestions.
  const parsed = useMemo(
    () => parseQuery(text, channels, people, me, meName),
    [text, channels, people, me, meName],
  );
  const suggestions = useMemo(
    () => (parsed.partial ? suggest(parsed.partial, channels, people, me, meName) : []),
    [parsed.partial, channels, people, me, meName],
  );
  useEffect(() => {
    if (Object.keys(parsed.filters).length === 0) return;
    setFilters((f) => ({ ...f, ...parsed.filters }));
    setText(
      parsed.partial ? `${parsed.text} ${text.split(/\s+/).pop() ?? ''}`.trim() : parsed.text,
    );
    // Only when the parser found something new to move into chips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.filters]);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(parsed.text.trim()), 250);
    return () => window.clearTimeout(id);
  }, [parsed.text]);
  useEffect(() => setHighlight(0), [suggestions.length]);

  const params: SearchParams = {
    q: debounced,
    channelId: filters.channel?.id,
    fromId: filters.from?.id,
    mentionsMe: filters.mentionsMe || undefined,
    hasLink: filters.hasLink || undefined,
    hasFile: filters.hasFile || undefined,
    threadsOnly: filters.threads || undefined,
    after: filters.range ? rangeStart(filters.range) : undefined,
  };
  const filtered = hasAnyFilter(filters);
  const search = useMessageSearch(workspaceId, params, filtered);
  // Project and card conversations have no page in the channel list, so they are left out here.
  const hits = (search.data ?? []).filter((h) =>
    ['public', 'private', 'dm'].includes(h.channel.kind),
  );
  const ready = debounced.length >= 2 || (debounced === '' && filtered);
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  // "Jump to" results: conversations and people whose names match the text.
  const jump = useMemo(() => {
    const q = debounced.toLowerCase();
    if (q.length < 1 || filtered) return { chans: [] as ChatChannel[], ppl: [] as typeof people };
    const chans = channels
      .filter(
        (c) =>
          (c.joined || c.kind === 'public') && channelTitle(c, me, you).toLowerCase().includes(q),
      )
      .slice(0, 4);
    const direct = new Set(
      channels.filter((c) => c.kind === 'dm').flatMap((c) => c.people.map((p) => p.id)),
    );
    const ppl = people
      .filter((p) => p.id !== me && !direct.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, 3);
    return { chans, ppl };
  }, [debounced, filtered, channels, people, me, you]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };
  const apply = (s: (typeof suggestions)[number]) => {
    setFilters((f) =>
      s.kind === 'in'
        ? { ...f, channel: { id: s.id, title: s.label } }
        : { ...f, from: { id: s.id, name: s.label } },
    );
    setText(parsed.text);
    input.current?.focus();
  };
  const toggle = (key: 'mentionsMe' | 'hasLink' | 'hasFile' | 'threads') =>
    setFilters((f) => ({ ...f, [key]: !f[key] || undefined }));
  const clearAll = () => {
    setFilters({});
    setText('');
    input.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setHighlight((h) => (h + d + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        apply(suggestions[Math.min(highlight, suggestions.length - 1)]!);
      }
    } else if (e.key === 'Backspace' && text === '') {
      // Backspace on an empty box removes the last chip, like a token field.
      setFilters((f) => {
        const order = ['from', 'channel'] as const;
        const k = order.find((x) => f[x]);
        return k ? { ...f, [k]: undefined } : f;
      });
    } else if (e.key === 'Enter' && hits[0]) {
      go(hitUrl(hits[0]));
    }
  };

  const chip = (on: boolean, label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
        on
          ? 'border-primary-border bg-primary-soft font-medium text-primary-ink'
          : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-muted',
      )}
    >
      <span className="[&_svg]:size-3.5 [&_svg]:stroke-[1.7]" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
  const removable = (label: string, onRemove: () => void) => (
    <span
      key={label}
      className="inline-flex h-7 items-center gap-1 rounded-md bg-primary-soft pl-2 pr-1 text-sm font-medium text-primary-ink"
    >
      {label}
      <button
        type="button"
        aria-label={t('search.removeFilter', { name: label })}
        onClick={onRemove}
        className="grid size-5 place-items-center rounded outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
  const rangeLabel = filters.range ? t(`search.range.${filters.range}`) : t('search.range.any');

  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={t('search.title')}>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 transition-[border-color,box-shadow] duration-micro focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
            <Search className="size-[18px] shrink-0 text-text-muted" aria-hidden />
            {filters.channel &&
              removable(`${t('search.in')}: ${filters.channel.title}`, () =>
                setFilters((f) => ({ ...f, channel: undefined })),
              )}
            {filters.from &&
              removable(`${t('search.from')}: ${filters.from.name}`, () =>
                setFilters((f) => ({ ...f, from: undefined })),
              )}
            <input
              ref={input}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={filtered ? t('search.placeholderFiltered') : t('search.placeholder')}
              aria-label={t('search.placeholder')}
              aria-autocomplete="list"
              className="h-8 min-w-40 flex-1 bg-transparent text-base text-text outline-none placeholder:text-text-faint focus-visible:shadow-none"
            />
            {(filtered || text) && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-1 text-xs font-medium text-text-muted outline-none hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t('search.clear')}
              </button>
            )}
          </div>
          {suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label={t('search.suggestions')}
              className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg"
            >
              {suggestions.map((s, i) => (
                <li
                  key={`${s.kind}-${s.id}`}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    apply(s);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                    i === highlight ? 'bg-primary-soft text-primary-ink' : 'text-text',
                  )}
                >
                  {s.kind === 'in' ? (
                    <Hash className="size-4 text-text-muted" aria-hidden />
                  ) : (
                    <UserRound className="size-4 text-text-muted" aria-hidden />
                  )}
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-text-muted">
                    {s.kind === 'in' ? t('search.inHint') : t('search.fromHint')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('search.filters')}>
          {active &&
            chip(filters.channel?.id === active.id, t('search.inThis'), <Hash />, () =>
              setFilters((f) => ({
                ...f,
                channel:
                  f.channel?.id === active.id
                    ? undefined
                    : { id: active.id, title: channelTitle(active, me, you) },
              })),
            )}
          {chip(filters.from?.id === me, t('search.fromMe'), <UserRound />, () =>
            setFilters((f) => ({
              ...f,
              from: f.from?.id === me ? undefined : { id: me, name: meName },
            })),
          )}
          {chip(!!filters.mentionsMe, t('search.includesMe'), <AtSign />, () =>
            toggle('mentionsMe'),
          )}
          {chip(!!filters.hasLink, t('search.hasLink'), <LinkIcon />, () => toggle('hasLink'))}
          {chip(!!filters.hasFile, t('search.hasFile'), <FileIcon />, () => toggle('hasFile'))}
          {chip(!!filters.threads, t('search.threadsOnly'), <MessagesSquare />, () =>
            toggle('threads'),
          )}
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                  filters.range
                    ? 'border-primary-border bg-primary-soft font-medium text-primary-ink'
                    : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-muted',
                )}
              >
                <CalendarDays className="size-3.5 stroke-[1.7]" aria-hidden />
                {rangeLabel}
              </button>
            </DropdownTrigger>
            <DropdownContent align="start" className="min-w-44">
              <DropdownRadioGroup
                value={filters.range ?? 'any'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, range: v === 'any' ? undefined : (v as DateRange) }))
                }
              >
                {(['any', 'day', 'week', 'month'] as const).map((r) => (
                  <DropdownRadioItem key={r} value={r}>
                    {t(`search.range.${r}`)}
                  </DropdownRadioItem>
                ))}
              </DropdownRadioGroup>
            </DropdownContent>
          </Dropdown>
        </div>

        <div className="max-h-[24rem] min-h-24 overflow-y-auto" aria-live="polite">
          {jump.chans.length + jump.ppl.length > 0 && (
            <section aria-label={t('search.jumpTo')} className="mb-2">
              <h3 className="px-1 pb-1 text-xs font-semibold text-text-muted">
                {t('search.jumpTo')}
              </h3>
              <ul className="space-y-0.5">
                {jump.chans.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => go(`/chat/${c.id}`)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-base text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <ChannelGlyph c={c} />
                      {channelTitle(c, me, you)}
                    </button>
                  </li>
                ))}
                {jump.ppl.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() =>
                        m.openDirect.mutate([p.id], { onSuccess: (c) => go(`/chat/${c.id}`) })
                      }
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-base text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Avatar name={p.name} size="xs" />
                      {p.name}
                      <span className="text-xs text-text-muted">{t('search.message')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!ready ? (
            <div className="px-2 py-6 text-center text-sm text-text-muted">
              <p>{t('search.hint')}</p>
              <p className="mt-2 font-mono text-xs">from:@anna in:#dev has:link</p>
            </div>
          ) : search.isPending ? (
            <div className="space-y-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : hits.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-text-muted">
              <MessagesSquare className="size-6" aria-hidden />
              <p className="text-sm">
                {debounced ? t('search.none', { q: debounced }) : t('search.noneFiltered')}
              </p>
            </div>
          ) : (
            <section aria-label={t('search.messages')}>
              <h3 className="px-1 pb-1 text-xs font-semibold text-text-muted">
                {t('search.messages')} · {hits.length}
              </h3>
              <ul className="space-y-1">
                {hits.map((h) => (
                  <li key={h.message.id}>
                    <button
                      type="button"
                      onClick={() => go(hitUrl(h))}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
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
                            {channelTitle(h.channel, me, you)}
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
                          {h.message.body ? (
                            <Snippet text={h.message.body} q={debounced} />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-text-muted">
                              <FileIcon className="size-3.5" aria-hidden />
                              {t('threads.attachment')}
                            </span>
                          )}
                        </span>
                      </span>
                      {(filters.hasFile || filters.hasLink) && <Check className="sr-only" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
