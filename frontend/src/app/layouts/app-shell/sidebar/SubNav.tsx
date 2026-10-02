import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useCardCounts } from '@/features/cards';
import { useCurrentWorkspace } from '@/features/workspaces';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { statusTone, toneClasses, type TaskStatus } from '@/shared/ui';
import type { NavChild } from '../navigation';

const SUB_ACTIVE_LAYOUT_ID = 'sidebar-active-subitem';

/** Indented tree of status links: one guide line, a status-coloured dot and the live task count. */
export function SubNav({ parentKey, items }: { parentKey: string; items: NavChild[] }) {
  const { t } = useTranslation('nav');
  const { workspace } = useCurrentWorkspace();
  const counts = useCardCounts(workspace?.id, {}).data;
  return (
    <ul
      className="relative ml-[22px] mt-1 flex flex-col gap-0.5 border-l border-border pl-1.5"
      aria-label={t(`items.${parentKey}`)}
    >
      {items.map((child) => {
        const status = child.key as TaskStatus;
        const count = counts?.[status];
        return (
          <li key={child.key}>
            <NavLink
              to={child.to}
              className={({ isActive }) =>
                cn(
                  'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-md transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                  isActive
                    ? 'font-medium text-primary-ink'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={SUB_ACTIVE_LAYOUT_ID}
                      transition={transition.spring}
                      aria-hidden
                      className="absolute inset-0 rounded-lg bg-primary-subtle"
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      'relative size-2 shrink-0 rounded-full',
                      toneClasses[statusTone[status]].fill,
                    )}
                  />
                  <span className="relative flex-1 truncate">{t(`tasks.${child.key}`)}</span>
                  {count !== undefined && (
                    <span className="tabular relative text-xs text-text-muted">{count}</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
