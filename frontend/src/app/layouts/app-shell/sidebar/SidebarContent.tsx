import { ChevronsLeft, LayoutPanelLeft, X } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Button, IconButton, Tooltip } from '@/shared/ui';
import { useShellLayout } from '@/shared/lib/shellLayout';
import { useNavigation } from '../useNavigation';
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
  const sections = useNavigation();
  const { t } = useTranslation('nav');
  const announcement = useAnnouncement();
  const setLayout = useShellLayout((s) => s.setLayout);
  const toggleLabel = mobile
    ? t('sidebar.close')
    : collapsed
      ? t('sidebar.expand')
      : t('sidebar.collapse');

  return (
    <>
      <div
        className={cn(
          'relative flex h-header shrink-0 items-center px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {/* Collapsed: the mark alone, centred; the toggle sits on the rail's edge, level with it. */}
        <BrandLogo collapsed={collapsed} />
        <IconButton
          label={toggleLabel}
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={mobile ? undefined : !collapsed}
          className={cn(
            collapsed &&
              'absolute -right-3 top-1/2 z-10 size-6 -translate-y-1/2 rounded-full border border-border bg-surface shadow-xs',
          )}
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

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-3">
        {sections.map((section, i) => (
          <Fragment key={section.key}>
            {collapsed ? (
              <div
                role="separator"
                className={cn('mx-3 mb-2 h-px bg-border-subtle', i > 0 ? 'mt-4' : 'mt-1')}
              />
            ) : (
              <h2
                className={cn(
                  'mb-1.5 h-5 px-1 text-xs font-medium uppercase tracking-wide text-text-muted',
                  i > 0 && 'mt-5',
                )}
              >
                {t(`sections.${section.key}`)}
              </h2>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => (
                <NavLinkItem key={item.key} item={item} collapsed={collapsed} />
              ))}
            </ul>
          </Fragment>
        ))}
      </nav>

      {!mobile && (
        <div className={cn('px-4 pb-3', collapsed && 'flex justify-center')}>
          {collapsed ? (
            <Tooltip content={t('sidebar.rail')} side="right">
              <IconButton
                label={t('sidebar.rail')}
                variant="ghost"
                onClick={() => setLayout('rail')}
              >
                <LayoutPanelLeft />
              </IconButton>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="sm" block onClick={() => setLayout('rail')}>
              <LayoutPanelLeft />
              {t('sidebar.rail')}
            </Button>
          )}
        </div>
      )}

      {announcement && (
        <div className="px-4 pb-4">
          <AnnouncementCard announcement={announcement} collapsed={collapsed} />
        </div>
      )}
    </>
  );
}
