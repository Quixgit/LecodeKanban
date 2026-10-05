import { Bell, BellOff, BellRing, Copy, Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import {
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  toast,
} from '@/shared/ui';
import type { ChatChannel, ChatNotifyLevel } from '../api/chatApi';
import { useChatMutations } from '../hooks/useChat';
import { MUTE_PRESETS, muteUntil } from '../model/mute';

interface Props {
  channel: ChatChannel;
  workspaceId: string;
  /** What to call the channel in the clipboard: its name or the people in the conversation. */
  title: string;
  active: boolean;
  /** Opens the channel in the second pane next to the current one. */
  onSplit?: (channelId: string) => void;
  /** Starts a search limited to this channel. */
  onSearchIn?: (channel: ChatChannel) => void;
  children: ReactNode;
}

const LEVELS: readonly ChatNotifyLevel[] = ['all', 'mentions', 'muted'];
const ICONS = { all: BellRing, mentions: Bell, muted: BellOff } as const;

/** Right-click menu of a channel in the sidebar, laid out like Slack's: details, copy, star, notifications, more, split view, leave. */
export function ChannelContextMenu({
  channel,
  workspaceId,
  title,
  active,
  onSplit,
  onSearchIn,
  children,
}: Props) {
  const { t } = useTranslation('chat');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const m = useChatMutations(workspaceId);
  const [leaving, setLeaving] = useState(false);
  const url = `${window.location.origin}/chat/${channel.id}`;
  const direct = channel.kind === 'dm';
  const member = channel.joined || direct;
  const onError = (e: unknown) => toast.error(errorText(e));
  const details = (tab?: string) => navigate(`/chat/${channel.id}?details=${tab ?? 'about'}`);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('menu.copied'));
    } catch {
      toast.error(t('menu.copyFailed'));
    }
  };
  const setLevel = (level: ChatNotifyLevel, until?: string) =>
    m.setNotify.mutate(
      { id: channel.id, level, until },
      { onSuccess: () => toast.success(t('menu.saved')), onError },
    );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-72" aria-label={t('sidebar.menu')}>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('menu.details')}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={() => details('about')}>
                {t('menu.viewDetails')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onSearchIn?.(channel)} disabled={!onSearchIn}>
                {t('menu.searchIn')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('menu.copy')}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {channel.name && (
                <ContextMenuItem onSelect={() => void copy(channel.name ?? title)}>
                  {t('menu.copyName')}
                </ContextMenuItem>
              )}
              <ContextMenuItem onSelect={() => void copy(url)}>
                {t('menu.copyLink')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void copy(channel.id)}>
                {t('menu.copyId')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {member && (
            <>
              <ContextMenuItem
                onSelect={() =>
                  m.star.mutate({ id: channel.id, on: !channel.starred }, { onError })
                }
              >
                {channel.starred ? t('menu.unstar') : t('menu.star')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuLabel className="normal-case tracking-normal">
                {t('menu.notify')}
              </ContextMenuLabel>
              <ContextMenuRadioGroup
                value={channel.notify}
                onValueChange={(level) => setLevel(level as ChatNotifyLevel)}
              >
                {LEVELS.map((level) => {
                  const Icon = ICONS[level];
                  return (
                    <ContextMenuRadioItem key={level} value={level}>
                      <Icon />
                      {t(`menu.${level}`)}
                    </ContextMenuRadioItem>
                  );
                })}
              </ContextMenuRadioGroup>
              {channel.mutedUntil && (
                <p className="px-8 pb-1 text-xs text-text-muted">
                  {t('menu.mutedUntil', { when: formatDate(channel.mutedUntil, language) })}
                </p>
              )}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('menu.more')}</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-64">
              {member && (
                <>
                  <ContextMenuLabel className="normal-case tracking-normal">
                    {t('menu.tempMute')}
                  </ContextMenuLabel>
                  {MUTE_PRESETS.map((preset) => (
                    <ContextMenuItem
                      key={preset}
                      onSelect={() => setLevel('muted', muteUntil(preset))}
                    >
                      {t(`menu.mute.${preset}`)}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuItem onSelect={() => navigate('/profile/notifications')}>
                    {t('menu.defaults')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  {(channel.unread > 0 || channel.mentions > 0) && (
                    <ContextMenuItem onSelect={() => m.markRead.mutate(channel.id, { onError })}>
                      {t('menu.markRead')}
                    </ContextMenuItem>
                  )}
                </>
              )}
              <ContextMenuItem onSelect={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                {t('menu.openTab')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => details('notifications')}>
                <Info />
                {t('menu.advanced')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onSplit?.(channel.id)} disabled={!onSplit}>
            <Copy />
            {t('menu.split')}
            <ContextMenuShortcut>{t('menu.splitHint')}</ContextMenuShortcut>
          </ContextMenuItem>
          {channel.joined && !direct && !channel.feed && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem danger onSelect={() => setLeaving(true)}>
                {t('menu.leave')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t('menu.leaveTitle')}
        description={t('menu.leaveBody')}
        confirmLabel={t('menu.leave')}
        loading={m.leave.isPending}
        onConfirm={() =>
          m.leave.mutate(channel.id, {
            onSuccess: () => {
              setLeaving(false);
              toast.success(t('menu.left'));
              if (active) navigate('/chat');
            },
            onError,
          })
        }
      />
    </>
  );
}
