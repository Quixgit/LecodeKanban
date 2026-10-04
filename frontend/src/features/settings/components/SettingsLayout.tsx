import { Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';

const SECTIONS: { to: string; key: 'profile' | 'security' | 'preferences'; icon: LucideIcon }[] = [
  { to: '/settings/profile', key: 'profile', icon: UserRound },
  { to: '/settings/security', key: 'security', icon: ShieldCheck },
  { to: '/settings/preferences', key: 'preferences', icon: Palette },
];

/** Settings shell: a section list beside the page (above it on narrow screens). */
export function SettingsLayout() {
  const { t } = useTranslation('settings');
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:gap-10">
      <nav aria-label={t('nav.label')} className="lg:w-52 lg:shrink-0">
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {SECTIONS.map(({ to, key, icon: Icon }) => (
            <li key={key} className="shrink-0">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive
                      ? 'bg-primary-subtle text-primary-ink ring-1 ring-primary-border'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                  )
                }
              >
                <Icon className="size-4 stroke-[1.7]" aria-hidden />
                {t(`nav.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

/** A titled block of a settings page. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs"
    >
      <header className="border-b border-border-subtle px-6 py-4">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </header>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <footer className="flex items-center justify-end gap-2 border-t border-border-subtle bg-surface-muted/50 px-6 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}
