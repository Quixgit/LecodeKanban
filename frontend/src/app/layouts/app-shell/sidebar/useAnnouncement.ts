import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { env } from '@/shared/config/env';
import type { Announcement } from './AnnouncementCard';

/**
 * Team meeting announcement: the meeting link comes from VITE_TEAM_MEETING_URL
 * (per-workspace links arrive with workspace settings); the avatars are the
 * current workspace's real members. Hidden when no link is configured.
 */
export function useAnnouncement(): Announcement | null {
  const { t } = useTranslation('nav');
  const { workspace } = useCurrentWorkspace();
  const members = useWorkspaceMembers(env.teamMeetingUrl ? workspace?.id : undefined);
  if (!env.teamMeetingUrl) return null;
  const list = members.data ?? [];
  return {
    title: t('announcement.title'),
    message: t('announcement.defaultMessage'),
    url: env.teamMeetingUrl,
    members: list.slice(0, 3).map((m) => ({ name: m.user.name, src: m.user.avatarUrl })),
    memberCount: list.length,
  };
}
