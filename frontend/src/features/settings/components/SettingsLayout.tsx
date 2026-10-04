import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { GROUPS, SECTIONS } from '../model/sections';

/** The admin centre shell: grouped sections on the left (a scrolling strip on narrow screens). */
export function SettingsLayout() {
  const { t } = useTranslation('settings');
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:gap-8">
      <nav
        aria-label={t('nav.label')}
        className="lg:sticky lg:top-4 lg:w-60 lg:shrink-0 lg:self-start"
      >
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible lg:pb-0">
          {GROUPS.map((group) => (
            <div key={group} className="flex shrink-0 gap-1 lg:flex-col">
              <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted lg:block">
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
                        'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors duration-micro focus-visible:shadow-focus',
                        isActive && !external
                          ? 'text-primary-ink'
                          : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !external && (
                          <motion.span
                            layoutId="settings-active"
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { type: 'spring', stiffness: 500, damping: 40 }
                            }
                            className="absolute inset-0 rounded-lg bg-primary-subtle ring-1 ring-primary-border"
                          />
                        )}
                        <Icon className="relative size-4 stroke-[1.7]" aria-hidden />
                        <span className="relative">{t(`sections.${key}.title`)}</span>
                        {external && (
                          <ArrowUpRight
                            className="relative ml-auto size-3.5 text-text-faint"
                            aria-hidden
                          />
                        )}
                      </>
                    )}
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
