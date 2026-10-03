import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { collapse, fade, transition } from '@/shared/motion';
import { Tooltip } from '@/shared/ui';
import { CollapsedFlyout } from './CollapsedFlyout';
import type { NavItem } from '../navigation';
import { useSidebarStore } from '../sidebarStore';
import { SubNav } from './SubNav';

const ACTIVE_LAYOUT_ID = 'sidebar-active-item';

function ActiveHighlight() {
  return (
    <motion.span
      layoutId={ACTIVE_LAYOUT_ID}
      transition={transition.spring}
      aria-hidden
      className="absolute inset-0 rounded-lg border border-primary-border bg-primary-subtle"
    />
  );
}

/** Top-level sidebar entry; renders an expandable group when it has children. */
export function NavLinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation('nav');
  const { pathname } = useLocation();
  const expanded = useSidebarStore((s) => s.expanded.includes(item.key));
  const toggleGroup = useSidebarStore((s) => s.toggleGroup);
  const expandGroup = useSidebarStore((s) => s.expandGroup);
  const label = t(`items.${item.key}`);
  const Icon = item.icon;
  const hasChildren = !!item.children?.length;
  const groupActive = hasChildren && pathname.startsWith(item.to);

  if (collapsed && hasChildren) {
    return (
      <li>
        <CollapsedFlyout item={item} label={label} />
      </li>
    );
  }

  return (
    <li>
      <div className="relative">
        <Tooltip content={label} side="right" enabled={collapsed}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={() => hasChildren && expandGroup(item.key)}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 w-full items-center rounded-lg text-md outline-none transition-colors duration-micro',
                collapsed ? 'justify-center gap-0 px-0' : 'gap-3 px-3',
                'focus-visible:shadow-focus',
                isActive
                  ? 'font-medium text-primary-ink'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                hasChildren && !collapsed && 'pr-10',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (!hasChildren || collapsed || !expanded || pathname === item.to) && (
                  <ActiveHighlight />
                )}
                {/* Fixed 20px slot: the icon keeps its x while the rail collapses and expands. */}
                <span className="relative grid size-5 shrink-0 place-items-center">
                  <Icon className="size-5 stroke-[1.6]" aria-hidden />
                </span>
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      variants={fade}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="relative flex-1 truncate"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        </Tooltip>
        {hasChildren && !collapsed && (
          <button
            type="button"
            onClick={() => toggleGroup(item.key)}
            aria-expanded={expanded}
            aria-label={t(expanded ? 'sidebar.collapseGroup' : 'sidebar.expandGroup', {
              name: label,
            })}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors duration-micro hover:bg-surface-sunken hover:text-text',
              groupActive ? 'text-primary-ink' : 'text-text-muted',
            )}
          >
            <ChevronDown
              className={cn(
                'size-4 stroke-[1.75] transition-transform duration-ui ease-out',
                expanded && 'rotate-180',
              )}
            />
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="sub"
              variants={collapse}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              <SubNav parentKey={item.key} items={item.children!} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </li>
  );
}
