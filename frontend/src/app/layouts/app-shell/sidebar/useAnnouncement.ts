import { useTranslation } from 'react-i18next';
import { env } from '@/shared/config/env';
import type { Announcement } from './AnnouncementCard';

/**
 * Current team announcement. Until the workspaces module provides
 * per-workspace announcements, the meeting link comes from
 * VITE_TEAM_MEETING_URL; when unset the card is hidden.
 */
export function useAnnouncement(): Announcement | null {
  const { t } = useTranslation('nav');
  if (!env.teamMeetingUrl) return null;
  return {
    title: t('announcement.title'),
    message: t('announcement.defaultMessage'),
    url: env.teamMeetingUrl,
    members: [],
    memberCount: 0,
  };
}
