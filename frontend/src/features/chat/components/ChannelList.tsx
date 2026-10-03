import {
  Bookmark,
  BellOff,
  ClipboardList,
  ChevronDown,
  Hash,
  Lock,
  MessagesSquare,
  Plus,
  Search,
  SquarePen,
  Star,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  Skeleton,
  Tooltip,
} from '@/shared/ui';
import type { ChatChannel, ChatStatus } from '../api/chatApi';
import { channelTitle, groupChannels } from '../model/channels';
import { useChatUiStore } from '../store/chatUiStore';
import { PersonAvatar, StatusBadge } from './PresenceDot';
import { SoundToggle } from './SoundToggle';

interface Props {
  channels: readonly ChatChannel[] | undefined;
  loading: boolean;
  me: string;
  activeId?: string;
  canCreate: boolean;
  onCreate: () => void;
  onBrowse: () => void;
  onNewMessage: () => void;
  onSearch: () => void;
  online: ReadonlySet<string>;
  statuses: ReadonlyMap<string, ChatStatus>;
}

/** Left column: joined channels and direct messages, unread ones in bold with a count. */
export function ChannelList({
  online,
  statuses,
  onSearch,
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
  const collapsed = useChatUiStore((s) => s.collapsed);
  const toggle = useChatUiStore((s) => s.toggleSection);
  const groups = useMemo(() => groupChannels(channels ?? []), [channels]);
  const starred = groups.starred;
  const joined = groups.channels;
  const direct = groups.direct;

  return (
    <nav aria-label={t('sidebar.label')} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onSearch}
          aria-label={t('search.open')}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-left text-sm text-text-muted outline-none transition-[border-color,box-shadow] duration-micro hover:border-border-strong focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{t('sidebar.filter')}</span>
        </button>
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
        <SoundToggle />
      </div>

      <ul className="space-y-0.5 px-2 pb-1">
        <NavRow to="/chat/threads" icon={<MessagesSquare />} label={t('sidebar.threads')} />
        <NavRow to="/chat/saved" icon={<Bookmark />} label={t('sidebar.saved')} />
      </ul>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <div className="space-y-2 p-2" aria-busy>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : (
          <>
            {starred.length > 0 && (
              <Section
                title={t('sidebar.starred')}
                icon={<Star className="fill-warning text-warning size-3.5" aria-hidden />}
                open={!collapsed.starred}
                onToggle={() => toggle('starred')}
              >
                {starred.map((c) => (
                  <Row
                    key={c.id}
                    c={c}
                    me={me}
                    active={c.id === activeId}
                    online={online}
                    statuses={statuses}
                  />
                ))}
              </Section>
            )}
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
                <li className="px-3 py-2 text-xs text-text-muted">{t('sidebar.noChannels')}</li>
              ) : (
                joined.map((c) => (
                  <Row
                    key={c.id}
                    c={c}
                    me={me}
                    active={c.id === activeId}
                    online={online}
                    statuses={statuses}
                  />
                ))
              )}
            </Section>
            <Section
              title={t('sidebar.direct')}
              open={!collapsed.direct}
              onToggle={() => toggle('direct')}
            >
              {direct.length === 0 ? (
                <li className="px-3 py-2 text-xs text-text-muted">{t('sidebar.noDirect')}</li>
              ) : (
                direct.map((c) => (
                  <Row
                    key={c.id}
                    c={c}
                    me={me}
                    active={c.id === activeId}
                    online={online}
                    statuses={statuses}
                  />
                ))
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
  icon,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
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
          {icon}
          {title}
        </button>
        {action}
      </div>
      {open && <ul className="space-y-0.5">{children}</ul>}
    </section>
  );
}

function Row({
  c,
  me,
  active,
  online,
  statuses,
}: {
  c: ChatChannel;
  me: string;
  active: boolean;
  online: ReadonlySet<string>;
  statuses: ReadonlyMap<string, ChatStatus>;
}) {
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
          // New activity: a soft tint and bold name, so the channel announces itself.
          unread && !active && 'border-primary-border/70 bg-primary-subtle font-semibold text-text',
        )}
      >
        <span className="grid size-5 shrink-0 place-items-center text-text-muted [&_svg]:size-4 [&_svg]:stroke-[1.7]">
          {c.feed ? (
            <ClipboardList className={cn(unread && 'text-primary-ink')} aria-hidden />
          ) : c.kind === 'public' ? (
            <Hash aria-hidden />
          ) : c.kind === 'private' ? (
            <Lock aria-hidden />
          ) : others.length > 1 ? (
            <Users aria-hidden />
          ) : (
            <PersonAvatar
              name={others[0]?.name ?? c.people[0]?.name ?? title}
              src={(others[0] ?? c.people[0])?.avatarUrl}
              online={online.has((others[0] ?? c.people[0])?.id ?? '')}
              status={statuses.get((others[0] ?? c.people[0])?.id ?? '')}
              size="xs"
            />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {others.length === 1 && <StatusBadge status={statuses.get(others[0]!.id)} />}
        {c.muted && (
          <BellOff className="size-3.5 shrink-0 text-text-faint" aria-label={t('sidebar.muted')} />
        )}
        {unread && c.feed && (
          <span className="relative flex size-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full rounded-full bg-danger opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-danger" />
          </span>
        )}
        {unread && (
          <span
            className={cn(
              'grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-2xs font-semibold tabular-nums',
              c.mentions > 0 || c.feed
                ? 'bg-danger text-white'
                : 'bg-primary-solid text-on-primary',
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

function NavRow({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            'flex h-9 items-center gap-2.5 rounded-lg border px-2.5 text-base outline-none transition-colors duration-micro focus-visible:shadow-focus',
            isActive
              ? 'border-primary-border bg-primary-subtle font-medium text-primary-ink'
              : 'border-transparent text-text-secondary hover:bg-surface-muted hover:text-text',
          )
        }
      >
        <span className="grid size-5 shrink-0 place-items-center text-text-muted [&_svg]:size-4 [&_svg]:stroke-[1.7]">
          {icon}
        </span>
        {label}
      </NavLink>
    </li>
  );
}
