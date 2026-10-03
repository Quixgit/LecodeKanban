import { BellOff, ChevronDown, Hash, Lock, Plus, Search, SquarePen, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import {
  Avatar,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  Skeleton,
  Tooltip,
} from '@/shared/ui';
import type { ChatChannel } from '../api/chatApi';
import { channelTitle, groupChannels } from '../model/channels';
import { useChatUiStore } from '../store/chatUiStore';

interface Props {
  channels: readonly ChatChannel[] | undefined;
  loading: boolean;
  me: string;
  activeId?: string;
  canCreate: boolean;
  onCreate: () => void;
  onBrowse: () => void;
  onNewMessage: () => void;
}

/** Left column: joined channels and direct messages, unread ones in bold with a count. */
export function ChannelList({
  channels,
  loading,
  me,
  activeId,
  canCreate,
  onCreate,
  onBrowse,
  onNewMessage,
}: Props) {
  const { t } = useTranslation('chat');
  const [filter, setFilter] = useState('');
  const collapsed = useChatUiStore((s) => s.collapsed);
  const toggle = useChatUiStore((s) => s.toggleSection);
  const groups = useMemo(() => groupChannels(channels ?? []), [channels]);
  const q = filter.trim().toLowerCase();
  const match = (c: ChatChannel) =>
    !q || channelTitle(c, me, t('list.you')).toLowerCase().includes(q);
  const joined = groups.channels.filter(match);
  const direct = groups.direct.filter(match);

  return (
    <nav aria-label={t('sidebar.label')} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('sidebar.filter')}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-faint"
            aria-hidden
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('sidebar.filter')}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-text placeholder:text-text-faint focus:border-primary focus:shadow-focus focus:outline-none"
          />
        </label>
        <Tooltip content={t('sidebar.newMessage')}>
          <IconButton
            label={t('sidebar.newMessage')}
            size="sm"
            variant="outline"
            onClick={onNewMessage}
          >
            <SquarePen />
          </IconButton>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 p-2" aria-busy>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : (
          <>
            <Section
              title={t('sidebar.channels')}
              open={!collapsed.channels}
              onToggle={() => toggle('channels')}
              action={
                <Dropdown>
                  <Tooltip content={t('sidebar.addChannel')}>
                    <DropdownTrigger asChild>
                      <IconButton label={t('sidebar.addChannel')} size="sm" variant="ghost">
                        <Plus />
                      </IconButton>
                    </DropdownTrigger>
                  </Tooltip>
                  <DropdownContent className="min-w-48" align="start">
                    {canCreate && (
                      <DropdownItem onSelect={onCreate}>
                        <Plus />
                        {t('sidebar.create')}
                      </DropdownItem>
                    )}
                    <DropdownItem onSelect={onBrowse}>
                      <Search />
                      {t('sidebar.browse')}
                    </DropdownItem>
                  </DropdownContent>
                </Dropdown>
              }
            >
              {joined.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">
                  {q ? t('sidebar.noMatch') : t('sidebar.noChannels')}
                </p>
              ) : (
                joined.map((c) => <Row key={c.id} c={c} me={me} active={c.id === activeId} />)
              )}
            </Section>
            <Section
              title={t('sidebar.direct')}
              open={!collapsed.direct}
              onToggle={() => toggle('direct')}
            >
              {direct.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">
                  {q ? t('sidebar.noMatch') : t('sidebar.noDirect')}
                </p>
              ) : (
                direct.map((c) => <Row key={c.id} c={c} me={me} active={c.id === activeId} />)
              )}
            </Section>
          </>
        )}
      </div>
    </nav>
  );
}

function Section({
  title,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-1">
      <div className="flex items-center justify-between pr-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-text-muted outline-none transition-colors duration-micro hover:text-text focus-visible:shadow-focus"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-ui', !open && '-rotate-90')}
            aria-hidden
          />
          {title}
        </button>
        {action}
      </div>
      {open && <ul className="space-y-0.5">{children}</ul>}
    </section>
  );
}

function Row({ c, me, active }: { c: ChatChannel; me: string; active: boolean }) {
  const { t } = useTranslation('chat');
  const title = channelTitle(c, me, t('list.you'));
  const unread = c.unread > 0 && !c.muted;
  const others = c.people.filter((p) => p.id !== me);
  return (
    <li>
      <NavLink
        to={`/chat/${c.id}`}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-base outline-none transition-colors duration-micro focus-visible:shadow-focus',
          active
            ? 'border border-primary-border bg-primary-subtle font-medium text-primary-ink'
            : 'border border-transparent text-text-secondary hover:bg-surface-muted hover:text-text',
          unread && !active && 'font-semibold text-text',
        )}
      >
        <span className="grid size-5 shrink-0 place-items-center text-text-muted [&_svg]:size-4 [&_svg]:stroke-[1.7]">
          {c.kind === 'public' ? (
            <Hash aria-hidden />
          ) : c.kind === 'private' ? (
            <Lock aria-hidden />
          ) : others.length > 1 ? (
            <Users aria-hidden />
          ) : (
            <Avatar
              name={others[0]?.name ?? c.people[0]?.name ?? title}
              src={(others[0] ?? c.people[0])?.avatarUrl}
              size="xs"
            />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {c.muted && (
          <BellOff className="size-3.5 shrink-0 text-text-faint" aria-label={t('sidebar.muted')} />
        )}
        {unread && (
          <span
            className={cn(
              'grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-2xs font-semibold tabular-nums',
              c.mentions > 0 ? 'bg-danger text-white' : 'bg-primary-solid text-on-primary',
            )}
            aria-label={t('sidebar.unread', { count: c.unread })}
          >
            {c.unread > 99 ? '99+' : c.unread}
          </span>
        )}
      </NavLink>
    </li>
  );
}
