import { useTranslation } from 'react-i18next';
import {
  countdown,
  matchPeople,
  useIntegrations,
  useMeetings,
  useNow,
} from '@/features/integrations';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useLanguage } from '@/shared/i18n';
import type { Announcement } from './AnnouncementCard';

/**
 * The card at the bottom of the sidebar. With Google Calendar connected and active it announces the
 * next meeting (a countdown, who is invited, a Join button); with nothing connected it offers to
 * connect; with a connected calendar and nothing coming up it stays out of the way.
 */
export function useAnnouncement(): Announcement | null {
  const { t } = useTranslation('integrations');
  const { language } = useLanguage();
  const { workspace } = useCurrentWorkspace();
  const now = useNow();
  const integrations = useIntegrations();
  const meetings = useMeetings();
  const members = useWorkspaceMembers(workspace?.id).data ?? [];
  const google = integrations.data?.items.find((i) => i.provider === 'google_calendar');
  if (!google?.configured) return null;

  if (!google.connected) {
    return {
      kind: 'connect',
      heading: '',
      title: t('card.connectTitle'),
      message: t('card.connectBody'),
      url: '/integrations',
      cta: t('card.connectCta'),
      members: [],
      memberCount: 0,
    };
  }
  const next = google.enabled ? meetings.data?.items[0] : undefined;
  if (!next) return null;

  const when = countdown(next.startsAt, now);
  const clock = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(next.startsAt),
  );
  const message =
    when.kind === 'now'
      ? t('card.now')
      : when.kind === 'minutes'
        ? t('card.startsIn', { minutes: when.minutes })
        : when.kind === 'hours'
          ? t('card.startsInHours', { hours: when.hours })
          : t('card.startsAt', { time: clock });
  const people = matchPeople(next.attendees, members);
  return {
    kind: 'meeting',
    heading: t('card.title'),
    title: next.title,
    message,
    url: next.url,
    cta: t('card.join'),
    soon: when.kind === 'now' || when.kind === 'minutes',
    members: people.slice(0, 3).map((m) => ({ name: m.user.name, src: m.user.avatarUrl })),
    memberCount: Math.max(next.attendees.length, people.length),
  };
}
