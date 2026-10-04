import {
  Bell,
  BellOff,
  Check,
  Copy,
  ExternalLink,
  Info,
  LogOut,
  MoreHorizontal,
  Star,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import {
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  toast,
} from '@/shared/ui';
import type { ChatChannel, ChatNotifyLevel } from '../api/chatApi';
import { useChatMutations } from '../hooks/useChat';

interface Props {
  channel: ChatChannel;
  workspaceId: string;
  /** What to call the channel in the clipboard: its name or the people in the conversation. */
  title: string;
  active: boolean;
  children: ReactNode;
}

const LEVELS: readonly ChatNotifyLevel[] = ['all', 'mentions', 'muted'];

/** Right-click menu of a channel in the sidebar: details, copy, star, notifications, leave. */
export function ChannelContextMenu({ channel, workspaceId, title, active, children }: Props) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const navigate = useNavigate();
  const m = useChatMutations(workspaceId);
  const [leaving, setLeaving] = useState(false);
  const url = `${window.location.origin}/chat/${channel.id}`;
  const direct = channel.kind === 'dm';
  const member = channel.joined || direct;
  const onError = (e: unknown) => toast.error(errorText(e));

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('menu.copied'));
    } catch {
      toast.error(t('menu.copyFailed'));
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-64" aria-label={t('sidebar.menu')}>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Info />
              {t('menu.details')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={() => navigate(`/chat/${channel.id}?details=1`)}>
                <Info />
                {t('menu.about')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => navigate(`/chat/${channel.id}?details=1`)}>
                <Users />
                {t('menu.members')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Copy />
              {t('menu.copy')}
            </ContextMenuSubTrigger>
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
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() =>
                  m.star.mutate({ id: channel.id, on: !channel.starred }, { onError })
                }
              >
                <Star className={channel.starred ? 'fill-warning !text-warning' : undefined} />
                {channel.starred ? t('menu.unstar') : t('menu.star')}
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Bell />
                  {t('menu.notify')}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-64">
                  <ContextMenuLabel>{t('menu.notify')}</ContextMenuLabel>
                  <ContextMenuRadioGroup
                    value={channel.notify}
                    onValueChange={(level) =>
                      m.setNotify.mutate(
                        { id: channel.id, level: level as ChatNotifyLevel },
                        { onSuccess: () => toast.success(t('menu.saved')), onError },
                      )
                    }
                  >
                    {LEVELS.map((level) => (
                      <ContextMenuRadioItem key={level} value={level} className="h-auto py-1.5">
                        {level === 'muted' ? <BellOff /> : <Bell />}
                        <span className="min-w-0">
                          <span className="block">{t(`menu.${level}`)}</span>
                          <span className="block text-xs text-text-muted">
                            {t(`menu.${level}Hint`)}
                          </span>
                        </span>
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <MoreHorizontal />
              {t('menu.more')}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {member && (channel.unread > 0 || channel.mentions > 0) && (
                <ContextMenuItem onSelect={() => m.markRead.mutate(channel.id, { onError })}>
                  <Check />
                  {t('menu.markRead')}
                </ContextMenuItem>
              )}
              <ContextMenuItem onSelect={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink />
                {t('menu.openTab')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {channel.joined && !direct && !channel.feed && (
            <ContextMenuItem danger onSelect={() => setLeaving(true)}>
              <LogOut />
              {t('menu.leave')}
            </ContextMenuItem>
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
