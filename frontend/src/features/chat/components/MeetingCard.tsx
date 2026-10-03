import { CalendarClock, MapPin, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { ChatMeeting } from '../api/chatApi';

/** A calendar reminder in a channel: the meeting, when it starts, and a link to join. */
export function MeetingCard({ meeting: m }: { meeting: ChatMeeting }) {
  const { t } = useTranslation('chat');
  const { language } = useLanguage();
  const start = new Date(m.startsAt);
  const minutes = Math.ceil((start.getTime() - Date.now()) / 60_000);
  const clock = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(
    start,
  );
  const day = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start);
  const when =
    minutes <= 0
      ? t('meeting.now')
      : minutes <= 90
        ? t('meeting.startsIn', { minutes })
        : t('meeting.startsAt', { time: clock });
  return (
    <div className="mt-1 max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex">
        <span className="w-1 shrink-0 bg-primary" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-primary-soft px-2 text-xs font-medium text-primary-ink">
              <CalendarClock className="size-3.5 stroke-[1.8]" aria-hidden />
              {t('meeting.label')}
            </span>
            <span className="text-xs font-medium text-text-secondary">{when}</span>
          </div>
          <p className="text-base font-semibold leading-snug text-text">{m.title}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
            <span className="tabular">
              {day} · {clock}
            </span>
            {m.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {m.location}
              </span>
            )}
          </p>
          {m.link && (
            <Button asChild size="sm">
              <a href={m.link} target="_blank" rel="noreferrer">
                <Video />
                {t('meeting.join')}
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
