import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { useSidebarStore } from '../sidebarStore';
import { useShellLayout } from '@/shared/lib/shellLayout';
import { RailSidebar } from './RailSidebar';
import { SidebarContent } from './SidebarContent';

const EXPANDED_W = 248;
const COLLAPSED_W = 77; // 76px inside the 1px border: 44px items with 16px gutters

/** Desktop navigation rail (lg and up); smaller screens use MobileNav. */
export function Sidebar() {
  const { t } = useTranslation('nav');
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const layout = useShellLayout((s) => s.layout);

  if (layout === 'rail') return <RailSidebar />;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      transition={transition.large}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-border-subtle bg-surface lg:flex"
      aria-label={t('sidebar.label')}
    >
      <SidebarContent collapsed={collapsed} onToggle={toggleCollapsed} />
    </motion.aside>
  );
}
