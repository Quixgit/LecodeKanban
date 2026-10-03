import { CalendarClock, Megaphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { AvatarGroup, Button, Tooltip } from '@/shared/ui';

export interface Announcement {
  /** A coming meeting from the calendar, or an invitation to connect it. */
  kind: 'meeting' | 'connect';
  heading: string;
  title: string;
  message: string;
  url: string;
  cta: string;
  /** Within the reminder window: the countdown is emphasised. */
  soon?: boolean;
  members: { name: string; src?: string | null }[];
  memberCount: number;
}

function Action({
  a,
  children,
  ...props
}: {
  a: Announcement;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return a.kind === 'connect' ? (
    <Link to={a.url} {...props}>
      {children}
    </Link>
  ) : (
    <a href={a.url} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  );
}

/** Bottom-of-sidebar card: the next meeting from Google Calendar with a "Join" link. */
export function AnnouncementCard({
  announcement: a,
  collapsed,
}: {
  announcement: Announcement;
  collapsed: boolean;
}) {
  const { t } = useTranslation('nav');
  const Icon = a.kind === 'meeting' ? CalendarClock : Megaphone;

  if (collapsed) {
    return (
      <Tooltip content={`${a.title} · ${a.message}`} side="right">
        <Action
          a={a}
          aria-label={a.cta}
          className="relative mx-auto flex size-11 items-center justify-center rounded-xl border border-primary-border bg-announce text-primary-ink shadow-sm transition-transform duration-micro hover:-translate-y-0.5"
        >
          <Icon className="size-5 stroke-[1.6]" />
          {a.soon && (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 size-2.5 rounded-full bg-danger ring-2 ring-surface"
            />
          )}
        </Action>
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
          <Icon
            className={cn('size-5 stroke-[1.6]', a.kind === 'connect' && '-rotate-12')}
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          {a.heading && (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">
              {a.heading}
            </p>
          )}
          <p className="line-clamp-2 text-sm font-semibold text-text" title={a.title}>
            {a.title}
          </p>
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1.5 text-xs',
              a.soon ? 'font-medium text-primary-ink' : 'text-text-secondary',
            )}
          >
            {a.soon && (
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            )}
            <span className="tabular">{a.message}</span>
          </p>
        </div>
      </div>
      {a.members.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5 pl-1">
          <span className="text-xs text-text-secondary">{t('announcement.members')}</span>
          <AvatarGroup people={a.members} total={a.memberCount} size="sm" />
        </div>
      )}
      <Button asChild size="sm" block className="mt-3.5">
        <Action a={a}>{a.cta}</Action>
      </Button>
    </section>
  );
}
