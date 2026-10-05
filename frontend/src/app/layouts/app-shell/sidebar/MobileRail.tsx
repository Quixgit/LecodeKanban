import { PanelLeft, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { useShellLayout } from '@/shared/lib/shellLayout';
import { IconButton } from '@/shared/ui';
import { useNavigation } from '../useNavigation';
import { useSidebarStore } from '../sidebarStore';
import { BrandLogo } from './BrandLogo';
import { SectionPanel } from './SectionPanel';
import { ownsList, panelFor } from './railPanels';

/**
 * The icon-rail menu on a phone, inside the drawer: tap an icon and its menu opens next to the strip (sections
 * that keep their list in the page, like Chat and Docs, just open); pick an entry and the drawer closes.
 */
export function MobileRail() {
  const { t } = useTranslation('nav');
  const sections = useNavigation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setLayout = useShellLayout((s) => s.setLayout);
  const close = useSidebarStore((s) => s.setMobileOpen);
  const items = sections.flatMap((s) => s.items);
  const here = items.find((i) => matchPath({ path: i.to, end: i.end ?? false }, pathname))?.key;
  const [picked, setPicked] = useState<string | undefined>(here);
  const shown = picked && panelFor(picked) && !ownsList(picked) ? picked : undefined;

  return (
    <div className="flex h-full">
      <div className="flex w-[68px] shrink-0 flex-col items-center border-r border-border-subtle">
        <div className="flex h-header shrink-0 items-center justify-center">
          <BrandLogo collapsed />
        </div>
        <nav
          aria-label={t('sidebar.label')}
          className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-3 pb-3 pt-2"
        >
          {items.map((item) => {
            const Icon = item.icon;
            const label = t(`items.${item.key}`);
            const on = (shown ?? here) === item.key;
            return (
              <button
                key={item.key}
                type="button"
                aria-label={label}
                aria-pressed={on}
                onClick={() => {
                  if (panelFor(item.key) && !ownsList(item.key)) setPicked(item.key);
                  else navigate(item.to);
                }}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl outline-none transition-colors duration-micro focus-visible:shadow-focus active:scale-95',
                  on
                    ? 'bg-primary-subtle text-primary-ink'
                    : 'text-text-muted hover:bg-surface-muted hover:text-text',
                )}
              >
                <Icon className="size-5 stroke-[1.6]" aria-hidden />
              </button>
            );
          })}
        </nav>
        <div className="pb-3">
          <IconButton
            label={t('sidebar.classic')}
            variant="ghost"
            onClick={() => setLayout('classic')}
          >
            <PanelLeft />
          </IconButton>
        </div>
      </div>
      <div className="min-w-0 flex-1 bg-surface-muted/40">
        {shown ? (
          <div className="flex h-full flex-col">
            <div className="flex justify-end px-2 pt-2">
              <IconButton
                label={t('sidebar.close')}
                variant="ghost"
                size="sm"
                onClick={() => close(false)}
              >
                <X />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">
              <SectionPanel itemKey={shown} />
            </div>
          </div>
        ) : (
          <p className="p-5 text-sm text-text-muted">{t('sidebar.pickSection')}</p>
        )}
      </div>
    </div>
  );
}
