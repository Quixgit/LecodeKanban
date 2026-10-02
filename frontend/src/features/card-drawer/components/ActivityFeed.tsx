import { History } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabels } from '@/features/cards';
import type { Member } from '@/shared/api';
import { useLanguage } from '@/shared/i18n';
import { formatDate, formatRelative } from '@/shared/lib/format';
import { Avatar, Button, Skeleton } from '@/shared/ui';
import { useActivity } from '../hooks/useDrawerData';
import { describeEntry } from '../model/activityText';

/** Who did what on this card, newest first. */
export function ActivityFeed({
  cardId,
  workspaceId,
  members,
}: {
  cardId: string;
  workspaceId: string;
  members: Member[];
}) {
  const { t } = useTranslation(['card', 'common']);
  const { language } = useLanguage();
  const feed = useActivity(cardId);
  const labels = useLabels(workspaceId);
  const lookups = useMemo(
    () => ({
      people: Object.fromEntries(members.map((m) => [m.user.id, m.user.name])),
      labels: Object.fromEntries((labels.data ?? []).map((l) => [l.id, l.name])),
      formatDate: (iso: string) => formatDate(iso, language),
    }),
    [members, labels.data, language],
  );
  const entries = (feed.data?.pages ?? []).flatMap((p) => p.items);

  if (feed.isPending) return <Skeleton className="h-24 rounded-lg" />;
  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <History className="size-4" aria-hidden />
        {t('activity.empty')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="relative flex flex-col gap-3 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-border-subtle">
        {entries.map((e) =>
          describeEntry(e, t, lookups).map((line, i) => (
            <li key={`${e.id}-${i}`} className="relative flex items-start gap-3">
              <Avatar
                size="xs"
                className="mt-0.5"
                name={e.actor?.name ?? '?'}
                src={e.actor?.avatarUrl}
              />
              <p className="min-w-0 flex-1 text-sm text-text-secondary">
                <span className="font-medium text-text">{e.actor?.name ?? t('someone')}</span>{' '}
                {line}
                <time
                  dateTime={e.at}
                  className="ml-2 text-xs text-text-faint"
                  title={new Date(e.at).toLocaleString(language)}
                >
                  {formatRelative(e.at, language)}
                </time>
              </p>
            </li>
          )),
        )}
      </ol>
      {feed.hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          loading={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {t('activity.more')}
        </Button>
      )}
    </div>
  );
}
