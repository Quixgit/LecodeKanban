import { motion } from 'framer-motion';
import { ChevronsLeft } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { IconButton } from '@/shared/ui';
import { navigation } from '../navigation';
import { useSidebarStore } from '../sidebarStore';
import { AnnouncementCard } from './AnnouncementCard';
import { BrandLogo } from './BrandLogo';
import { NavLinkItem } from './NavLinkItem';
import { useAnnouncement } from './useAnnouncement';

const EXPANDED_W = 248;
const COLLAPSED_W = 76;

export function Sidebar() {
  const { t } = useTranslation('nav');
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const announcement = useAnnouncement();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={transition.large}
      className="sticky top-0 z-30 flex h-dvh shrink-0 flex-col border-r border-border-subtle bg-surface"
      aria-label={t('sidebar.label')}
    >
      <div
        className={cn(
          'flex h-header items-center px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && <BrandLogo collapsed={collapsed} />}
        <IconButton
          label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
        >
          <ChevronsLeft
            className={cn(
              'transition-transform duration-large ease-out',
              collapsed && 'rotate-180',
            )}
          />
        </IconButton>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-3">
        {navigation.map((section, i) => (
          <Fragment key={section.key}>
            <h2
              className={cn(
                'mb-1.5 h-5 px-1 text-xs font-medium uppercase tracking-wide text-text-muted transition-opacity duration-ui',
                i > 0 && 'mt-5',
                collapsed && 'opacity-0',
              )}
              aria-hidden={collapsed}
            >
              {t(`sections.${section.key}`)}
            </h2>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <NavLinkItem key={item.key} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>

      {announcement && (
        <div className="px-3 pb-4">
          <AnnouncementCard announcement={announcement} collapsed={collapsed} />
        </div>
      )}
    </motion.aside>
  );
}
