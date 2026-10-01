import { Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AvatarGroup, Button, Tooltip } from '@/shared/ui';

export interface Announcement {
  title: string;
  message: string;
  url: string;
  members: { name: string; src?: string | null }[];
  memberCount: number;
}

/** Bottom-of-sidebar card: next team meeting with a "Join Now" link. */
export function AnnouncementCard({
  announcement,
  collapsed,
}: {
  announcement: Announcement;
  collapsed: boolean;
}) {
  const { t } = useTranslation('nav');

  if (collapsed) {
    return (
      <Tooltip content={announcement.title} side="right">
        <a
          href={announcement.url}
          target="_blank"
          rel="noreferrer"
          aria-label={t('announcement.join')}
          className="mx-auto flex size-11 items-center justify-center rounded-xl border border-primary-border bg-announce text-primary-ink shadow-sm transition-transform duration-micro hover:-translate-y-0.5"
        >
          <Megaphone className="size-5 stroke-[1.6]" />
        </a>
      </Tooltip>
    );
  }

  return (
    <section
      aria-label={t('announcement.label')}
      className="rounded-xl border border-primary-border bg-announce p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface/80 text-primary-ink shadow-xs">
          <Megaphone className="size-5 -rotate-12 stroke-[1.6]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{announcement.title}</p>
          <p className="truncate text-xs text-text-secondary">{announcement.message}</p>
        </div>
      </div>
      {announcement.members.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5 pl-1">
          <span className="text-xs text-text-secondary">{t('announcement.members')}</span>
          <AvatarGroup people={announcement.members} total={announcement.memberCount} size="sm" />
        </div>
      )}
      <Button asChild size="sm" block className="mt-3.5">
        <a href={announcement.url} target="_blank" rel="noreferrer">
          {t('announcement.join')}
        </a>
      </Button>
    </section>
  );
}
