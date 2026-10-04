import { BadgeCheck, MapPin, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui';

const TABS: { to: string; key: 'profile' | 'security'; icon: LucideIcon }[] = [
  { to: '/profile', key: 'profile', icon: UserRound },
  { to: '/profile/security', key: 'security', icon: ShieldCheck },
];

/** The person's own page: a header with who they are, and tabs for profile and security. */
export function ProfileLayout() {
  const { t } = useTranslation('profile');
  const { user } = useSession();
  const reduce = useReducedMotion();
  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs">
        <div className="h-20 bg-gradient-to-r from-primary-subtle via-surface-muted to-primary-subtle" />
        <div className="flex flex-wrap items-end gap-4 px-6 pb-4">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" ring className="-mt-8 size-20" />
          <div className="min-w-0 flex-1 pt-3">
            <h2 className="truncate text-xl font-semibold text-text">{user.name}</h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-text-muted">
              {user.jobTitle && <span>{user.jobTitle}</span>}
              <span className="inline-flex items-center gap-1">
                {user.emailVerified && (
                  <BadgeCheck className="size-3.5 text-available" aria-hidden />
                )}
                {user.email}
              </span>
              {user.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {user.location}
                </span>
              )}
            </p>
          </div>
        </div>
        <nav aria-label={t('nav.label')} className="border-t border-border-subtle px-3">
          <ul className="flex gap-1">
            {TABS.map(({ to, key, icon: Icon }) => (
              <li key={key}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2 px-3 py-3 text-sm font-medium outline-none transition-colors duration-micro focus-visible:shadow-focus',
                      isActive ? 'text-primary-ink' : 'text-text-secondary hover:text-text',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="size-4 stroke-[1.7]" aria-hidden />
                      {t(`nav.${key}`)}
                      {isActive && (
                        <motion.span
                          layoutId="profile-tab"
                          transition={reduce ? { duration: 0 } : { duration: 0.25 }}
                          className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
