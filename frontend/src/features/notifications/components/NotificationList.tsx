import { BellOff, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/format';
import { Avatar, Button, EmptyState, Skeleton } from '@/shared/ui';
import type { AppNotification } from '../api/notificationsApi';
import { useMarkNotifications, useNotifications } from '../hooks/useNotifications';
import { KIND_ICONS, targetOf } from '../model/describe';

function Row({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const Icon = KIND_ICONS[n.kind];
  const actor = n.actor?.name ?? t('notifications.someone');
  const kind = n.kind === 'mention' && !n.title ? 'mention_direct' : n.kind;
  const meeting = n.kind === 'meeting';
  const text = t(`notifications.kinds.${kind}`, {
    actor,
    subject: n.title,
    channel: `#${n.title}`,
    column: n.body,
    time: meeting
      ? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(
          new Date(n.body),
        )
      : '',
  });
  const detail = n.kind === 'task_moved' || meeting ? '' : n.body;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:bg-surface-muted',
          !n.read && 'bg-primary-subtle/70',
        )}
      >
        {meeting ? (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink [&_svg]:size-4 [&_svg]:stroke-[1.7]">
            <Icon aria-hidden />
          </span>
        ) : (
          <span className="relative mt-0.5 shrink-0">
            <Avatar name={actor} src={n.actor?.avatarUrl} size="sm" />
            <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full border border-border bg-surface text-text-muted [&_svg]:size-2.5 [&_svg]:stroke-[2]">
              <Icon aria-hidden />
            </span>
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm text-text', !n.read && 'font-medium')}>{text}</span>
          {detail && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-text-muted">{detail}</span>
          )}
          <span className="mt-1 block text-xs text-text-muted">
            {formatRelative(n.createdAt, language)}
          </span>
        </span>
        {!n.read && (
          <span
            role="img"
            aria-label={t('notifications.unreadItem')}
            className="mt-2 size-2 shrink-0 rounded-full bg-primary-solid"
          />
        )}
      </button>
    </li>
  );
}

/** The bell's panel: newest first, unread highlighted; a click opens the task or conversation. */
export function NotificationList({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { query, items, unread, ws, me } = useNotifications();
  const mark = useMarkNotifications(ws, me);

  const open = (n: AppNotification) => {
    if (!n.read) mark.mutate({ ids: [n.id] });
    const target = targetOf(n);
    if (target && 'card' in target) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('card', target.card);
          return next;
        },
        { replace: false },
      );
    } else if (target && 'link' in target) {
      window.open(target.link, '_blank', 'noopener,noreferrer');
    } else if (target) {
      navigate(`/chat/${target.channel}`);
    }
    onNavigate();
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <p className="text-base font-semibold text-text">{t('notifications.title')}</p>
        <Button
          size="sm"
          variant="ghost"
          disabled={unread === 0 || mark.isPending}
          onClick={() => mark.mutate({ all: true })}
        >
          <CheckCheck />
          {t('notifications.markAll')}
        </Button>
      </div>
      {query.isPending ? (
        <div className="space-y-3 p-4" aria-busy>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="py-10"
          icon={<BellOff />}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyDescription')}
        />
      ) : (
        <ul className="scroll-quiet max-h-[26rem] divide-y divide-border-subtle overflow-y-auto">
          {items.map((n) => (
            <Row key={n.id} n={n} onOpen={open} />
          ))}
          {query.hasNextPage && (
            <li className="p-2 text-center">
              <Button
                size="sm"
                variant="ghost"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {t('notifications.more')}
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
