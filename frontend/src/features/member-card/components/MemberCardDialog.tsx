import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Globe,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { chatApi } from '@/features/chat';
import { RolePill, useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import { scaleIn } from '@/shared/motion';
import { Avatar, Button, IconButton, Pill, ProfileCover, Skeleton, toast } from '@/shared/ui';
import type { MemberProfile } from '../api/memberApi';
import { useMemberProfile } from '../hooks/useMemberProfile';
import { isWorkingNow, localTimeIn } from '../model/localTime';
import { useMemberCardStore } from '../store/memberCardStore';

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 stroke-[1.7] text-text-muted" aria-hidden />
      <span className="min-w-0">
        <span className="block text-xs text-text-muted">{label}</span>
        <span className="block break-words text-text">{children}</span>
      </span>
    </li>
  );
}

const linkClass =
  'text-primary-ink underline-offset-2 hover:underline focus-visible:shadow-focus outline-none rounded';

function Card({ profile }: { profile: MemberProfile }) {
  const { t } = useTranslation('memberCard');
  const { language } = useLanguage();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const { user: me } = useSession();
  const { workspace } = useCurrentWorkspace();
  const close = useMemberCardStore((s) => s.close);
  const local = localTimeIn(profile.timezone, language);
  const working = isWorkingNow(profile.workStart, profile.workEnd, profile.timezone);
  const isMe = me?.id === profile.id;

  const message = () => {
    if (!workspace) return;
    chatApi
      .openDirect(workspace.id, [profile.id])
      .then((ch) => {
        close();
        navigate(`/chat/${ch.id}`);
      })
      .catch((e) => toast.error(errorText(e)));
  };

  return (
    <>
      <ProfileCover url={profile.coverUrl} preset={profile.coverPreset} className="h-24" />
      <div className="px-6 pb-6">
        <Avatar
          name={profile.name}
          src={profile.avatarUrl}
          size="xl"
          ring
          className="-mt-10 size-20"
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Dialog.Title className="flex flex-wrap items-center gap-2 text-xl font-semibold text-text">
              {profile.name}
              <RolePill role={profile.role} />
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-sm text-text-muted">
              {[profile.jobTitle, profile.pronouns].filter(Boolean).join(' · ') || t('noTitle')}
            </Dialog.Description>
          </div>
          {!isMe && (
            <Button size="sm" onClick={message}>
              <MessageSquare />
              {t('message')}
            </Button>
          )}
        </div>

        {profile.bio && (
          <p className="mt-4 whitespace-pre-line text-sm text-text-secondary">{profile.bio}</p>
        )}

        {profile.skills.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t('skills')}>
            {profile.skills.map((s) => (
              <li key={s}>
                <Pill tone="teal" size="sm">
                  {s}
                </Pill>
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {local && (
            <Row icon={Clock} label={t('localTime')}>
              {local.time}
              {local.offsetHours !== 0 &&
                ` · ${t('offset', { hours: `${local.offsetHours > 0 ? '+' : '−'}${Math.abs(local.offsetHours)}` })}`}
              {profile.workStart && (
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                  <span
                    className={`size-1.5 rounded-full ${working ? 'bg-available' : 'bg-border-strong'}`}
                    aria-hidden
                  />
                  {working ? t('working') : t('offHours')} · {profile.workStart}–{profile.workEnd}
                </span>
              )}
            </Row>
          )}
          {!local && profile.workStart && (
            <Row icon={Clock} label={t('hours')}>
              {profile.workStart}–{profile.workEnd}
            </Row>
          )}
          {profile.location && (
            <Row icon={MapPin} label={t('location')}>
              {profile.location}
            </Row>
          )}
          <Row icon={Mail} label={t('email')}>
            <a className={linkClass} href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
          </Row>
          {profile.phone && (
            <Row icon={Phone} label={t('phone')}>
              <a className={linkClass} href={`tel:${profile.phone.replace(/\s+/g, '')}`}>
                {profile.phone}
              </a>
            </Row>
          )}
          {profile.telegram && (
            <Row icon={Send} label="Telegram">
              <a
                className={linkClass}
                href={`https://t.me/${profile.telegram}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{profile.telegram}
              </a>
            </Row>
          )}
          {profile.linkedin && (
            <Row icon={Link2} label="LinkedIn">
              <a
                className={linkClass}
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                {profile.linkedin.replace('https://www.linkedin.com/', '')}
              </a>
            </Row>
          )}
          {profile.website && (
            <Row icon={Globe} label={t('website')}>
              <a
                className={linkClass}
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            </Row>
          )}
          <Row icon={CalendarDays} label={t('joined')}>
            {formatDate(profile.joinedAt, language)}
          </Row>
        </ul>
        <p className="mt-5 flex items-center gap-1.5 text-xs text-text-muted">
          <BadgeCheck className="size-3.5" aria-hidden />
          {t('visibleToTeam')}
        </p>
      </div>
    </>
  );
}

/** The profile card of a teammate, opened from any name or avatar. Mounted once in the app shell. */
export function MemberCardDialog() {
  const { t } = useTranslation('memberCard');
  const userId = useMemberCardStore((s) => s.userId);
  const close = useMemberCardStore((s) => s.close);
  const { workspace } = useCurrentWorkspace();
  const profile = useMemberProfile(workspace?.id, userId);
  const errorText = useErrorText();

  return (
    <Dialog.Root open={!!userId} onOpenChange={(o) => !o && close()}>
      <AnimatePresence>
        {userId && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay forceMount asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-overlay/25 backdrop-blur-[3px]"
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-50 grid grid-cols-1 place-items-center p-4">
              <Dialog.Content forceMount asChild aria-describedby={undefined}>
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-subtle bg-surface shadow-lg"
                >
                  <Dialog.Close asChild>
                    <IconButton
                      label={t('close')}
                      variant="outline"
                      size="sm"
                      className="absolute right-3 top-3 z-10 bg-surface/90 backdrop-blur"
                    >
                      <X />
                    </IconButton>
                  </Dialog.Close>
                  {profile.isPending ? (
                    <div className="p-6" aria-busy>
                      <Dialog.Title className="sr-only">{t('loading')}</Dialog.Title>
                      <Skeleton className="h-40" />
                    </div>
                  ) : profile.data ? (
                    <Card profile={profile.data} />
                  ) : (
                    <div className="p-6">
                      <Dialog.Title className="text-lg font-semibold text-text">
                        {t('unavailable')}
                      </Dialog.Title>
                      <p className="mt-1 text-sm text-text-muted">{errorText(profile.error)}</p>
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
