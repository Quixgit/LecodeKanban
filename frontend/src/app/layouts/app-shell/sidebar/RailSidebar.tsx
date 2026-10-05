import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { matchPath, NavLink, useLocation } from 'react-router-dom';
import { useChatUnread } from '@/features/chat';
import { useCurrentWorkspace } from '@/features/workspaces';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { IconButton, Tooltip } from '@/shared/ui';
import type { NavItem } from '../navigation';
import { useNavigation } from '../useNavigation';
import { useShellLayout } from '@/shared/lib/shellLayout';
import { BrandLogo } from './BrandLogo';
import { panelFor, panelWidth } from './railPanels';
import { SectionPanel } from './SectionPanel';

const RAIL_W = 68;
const ACTIVE_ID = 'rail-active-item';

function RailItem({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useTranslation('nav');
  const { workspace } = useCurrentWorkspace();
  const unread = useChatUnread(workspace?.id);
  const Icon = item.icon;
  const label = t(`items.${item.key}`);
  return (
    <li>
      <Tooltip content={label} side="right">
        <NavLink
          to={item.to}
          end={item.end}
          aria-label={label}
          className={cn(
            'group relative grid size-11 place-items-center rounded-xl outline-none transition-colors duration-micro focus-visible:shadow-focus',
            active ? 'text-primary-ink' : 'text-text-muted hover:bg-surface-muted hover:text-text',
          )}
        >
          {active && (
            <motion.span
              layoutId={ACTIVE_ID}
              transition={transition.spring}
              aria-hidden
              className="absolute inset-0 rounded-xl border border-primary-border bg-primary-subtle"
            />
          )}
          <Icon
            className="relative size-5 stroke-[1.6] transition-transform duration-ui group-hover:scale-110"
            aria-hidden
          />
          {item.key === 'chat' && unread.total > 0 && (
            <span
              aria-hidden
              className={cn(
                'absolute right-1.5 top-1.5 size-2.5 rounded-full ring-2 ring-surface',
                unread.urgent > 0 ? 'bg-danger-ink' : 'bg-primary-solid',
              )}
            />
          )}
        </NavLink>
      </Tooltip>
    </li>
  );
}

/** Icon strip with, to its right, the menu of the section you are in (Huly-style). Desktop only. */
export function RailSidebar() {
  const { t } = useTranslation('nav');
  const sections = useNavigation();
  const { pathname } = useLocation();
  const setLayout = useShellLayout((s) => s.setLayout);
  const items = sections.flatMap((s) => s.items);
  const current = items.find((i) => matchPath({ path: i.to, end: i.end ?? false }, pathname));
  const hasPanel = !!current && panelFor(current.key);
  // Keep the last width while the column closes, so the content does not jump.
  const [width, setWidth] = useState(232);
  useEffect(() => {
    if (current && panelFor(current.key)) setWidth(panelWidth(current.key));
  }, [current]);

  return (
    <aside
      aria-label={t('sidebar.label')}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 border-r border-border-subtle bg-surface lg:flex"
    >
      <div className="flex shrink-0 flex-col items-center" style={{ width: RAIL_W }}>
        <div className="flex h-header shrink-0 items-center justify-center">
          <BrandLogo collapsed />
        </div>
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-3 pb-3 pt-2">
          {sections.map((section, i) => (
            <ul key={section.key} className="flex flex-col items-center gap-1">
              {i > 0 && (
                <li role="separator" aria-hidden className="my-2 h-px w-7 bg-border-subtle" />
              )}
              {section.items.map((item) => (
                <RailItem key={item.key} item={item} active={current?.key === item.key} />
              ))}
            </ul>
          ))}
        </nav>
        <div className="pb-3">
          <Tooltip content={t('sidebar.classic')} side="right">
            <IconButton
              label={t('sidebar.classic')}
              variant="ghost"
              onClick={() => setLayout('classic')}
            >
              <PanelLeft />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <motion.div
        initial={false}
        animate={{ width: hasPanel ? width : 0, opacity: hasPanel ? 1 : 0 }}
        transition={transition.large}
        className="overflow-hidden border-l border-border-subtle bg-surface-muted/40"
        aria-hidden={!hasPanel}
      >
        <div style={{ width }} className="h-full">
          {current && hasPanel && <SectionPanel itemKey={current.key} />}
        </div>
      </motion.div>
    </aside>
  );
}
