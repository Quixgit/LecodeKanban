import { CalendarClock, MapPin, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { Button, Skeleton } from '@/shared/ui';
import { useMeetings } from '../hooks/useIntegrations';

/** The caller's next meetings, each with a Join button. */
export function MeetingList() {
  const { t } = useTranslation('integrations');
  const { language } = useLanguage();
  const meetings = useMeetings();
  const day = new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const clock = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' });

  if (meetings.isPending) return <Skeleton className="h-16 rounded-lg" />;
  const items = meetings.data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-text-muted">{t('meetings.empty')}</p>;
  }
  return (
    <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-3.5 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink">
            <CalendarClock className="size-4.5 stroke-[1.7]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{m.title}</p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
              <span className="tabular">
                {day.format(new Date(m.startsAt))} · {clock.format(new Date(m.startsAt))}
              </span>
              {m.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden />
                  <span className="truncate">{m.location}</span>
                </span>
              )}
            </p>
          </div>
          {m.url && (
            <Button asChild size="sm" variant="secondary">
              <a href={m.url} target="_blank" rel="noreferrer">
                <Video />
                {t('meetings.join')}
              </a>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
