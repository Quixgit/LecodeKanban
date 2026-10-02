import { ChevronsLeft, X } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { IconButton } from '@/shared/ui';
import { navigation } from '../navigation';
import { AnnouncementCard } from './AnnouncementCard';
import { BrandLogo } from './BrandLogo';
import { NavLinkItem } from './NavLinkItem';
import { useAnnouncement } from './useAnnouncement';

interface Props {
  collapsed: boolean;
  /** Desktop: collapse toggle. Mobile drawer: close button instead. */
  onToggle: () => void;
  mobile?: boolean;
}

/** Brand, navigation sections and the announcement card — shared by the desktop rail and the mobile drawer. */
export function SidebarContent({ collapsed, onToggle, mobile }: Props) {
  const { t } = useTranslation('nav');
  const announcement = useAnnouncement();

  return (
    <>
      <div
        className={cn(
          'flex h-header shrink-0 items-center px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && <BrandLogo collapsed={collapsed} />}
        <IconButton
          label={
            mobile ? t('sidebar.close') : collapsed ? t('sidebar.expand') : t('sidebar.collapse')
          }
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={mobile ? undefined : !collapsed}
        >
          {mobile ? (
            <X />
          ) : (
            <ChevronsLeft
              className={cn(
                'transition-transform duration-large ease-out',
                collapsed && 'rotate-180',
              )}
            />
          )}
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
    </>
  );
}
