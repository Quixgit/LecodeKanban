import {
  CalendarDays,
  ClipboardList,
  Gauge,
  Headset,
  House,
  Package,
  Plug,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavChild {
  key: string;
  to: string;
}

export interface NavItem {
  key: string;
  to: string;
  icon: LucideIcon;
  children?: NavChild[];
  /** Exact match for "/" so Dashboard is not active everywhere. */
  end?: boolean;
}

export interface NavSection {
  key: 'mainMenu' | 'workspace';
  items: NavItem[];
}

/** Sidebar structure. Labels resolve via the `nav` namespace: nav:items.<key>. */
export const navigation: NavSection[] = [
  {
    key: 'mainMenu',
    items: [
      { key: 'dashboard', to: '/', icon: House, end: true },
      { key: 'projects', to: '/projects', icon: Package },
      { key: 'calendar', to: '/calendar', icon: CalendarDays },
      {
        key: 'tasks',
        to: '/tasks',
        icon: ClipboardList,
        children: [
          { key: 'todo', to: '/tasks/todo' },
          { key: 'in_progress', to: '/tasks/in-progress' },
          { key: 'in_review', to: '/tasks/in-review' },
          { key: 'done', to: '/tasks/completed' },
        ],
      },
      { key: 'performance', to: '/performance', icon: Gauge },
      { key: 'help', to: '/help', icon: Headset },
    ],
  },
  {
    key: 'workspace',
    items: [
      { key: 'team', to: '/team', icon: UsersRound },
      { key: 'integrations', to: '/integrations', icon: Plug },
      { key: 'settings', to: '/settings', icon: Settings },
    ],
  },
];
