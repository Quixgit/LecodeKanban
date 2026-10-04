import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { GROUPS, SECTIONS } from '../model/sections';

/** The admin centre shell: one card of grouped sections on the left (a scrolling strip on narrow screens). */
export function SettingsLayout() {
  const { t } = useTranslation('settings');
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <nav
        aria-label={t('nav.label')}
        className="rounded-2xl border border-border-subtle bg-surface p-2 shadow-card lg:sticky lg:top-4 lg:w-64 lg:shrink-0 lg:group-data-[layout=rail]/shell:hidden"
      >
        <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-4 lg:overflow-visible lg:p-1">
          {GROUPS.map((group) => (
            <div key={group} className="flex shrink-0 gap-1 lg:flex-col">
              <p className="hidden px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-text-muted lg:block">
                {t(`groups.${group}`)}
              </p>
              {SECTIONS.filter((s) => s.group === group).map(
                ({ key, to, icon: Icon, external }) => (
                  <NavLink
                    key={key}
                    to={to}
                    end={key === 'overview'}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm font-medium outline-none transition-colors duration-micro focus-visible:shadow-focus',
                        isActive && !external
                          ? 'text-primary-ink'
                          : 'text-text-secondary hover:text-text',
                      )
                    }
                  >
                    {({ isActive }) => {
                      const on = isActive && !external;
                      return (
                        <>
                          {on && (
                            <motion.span
                              layoutId="settings-active"
                              transition={
                                reduce
                                  ? { duration: 0 }
                                  : { type: 'spring', stiffness: 500, damping: 40 }
                              }
                              className="absolute inset-0 rounded-xl border border-primary-border bg-primary-subtle"
                            />
                          )}
                          <span
                            className={cn(
                              'relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-micro [&_svg]:size-4 [&_svg]:stroke-[1.7]',
                              on
                                ? 'bg-surface text-primary-ink'
                                : 'bg-surface-muted text-text-muted',
                            )}
                          >
                            <Icon aria-hidden />
                          </span>
                          <span className="relative">{t(`sections.${key}.title`)}</span>
                          {external && (
                            <ArrowUpRight
                              className="relative ml-auto size-3.5 text-text-faint"
                              aria-hidden
                            />
                          )}
                        </>
                      );
                    }}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
