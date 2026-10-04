import {
  Blocks,
  LayoutDashboard,
  ListPlus,
  SlidersHorizontal,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type SectionKey = 'overview' | 'general' | 'fields' | 'labels' | 'members' | 'integrations';

export interface Section {
  key: SectionKey;
  to: string;
  icon: LucideIcon;
  group: 'workspace' | 'tasks' | 'access';
  /** Sections that live on another page of the app open it instead of a settings page. */
  external?: boolean;
}

export const SECTIONS: readonly Section[] = [
  { key: 'overview', to: '/settings', icon: LayoutDashboard, group: 'workspace' },
  { key: 'general', to: '/settings/general', icon: SlidersHorizontal, group: 'workspace' },
  { key: 'fields', to: '/settings/fields', icon: ListPlus, group: 'tasks' },
  { key: 'labels', to: '/settings/labels', icon: Tags, group: 'tasks' },
  { key: 'members', to: '/team', icon: Users, group: 'access', external: true },
  { key: 'integrations', to: '/integrations', icon: Blocks, group: 'access', external: true },
];

export const GROUPS = ['workspace', 'tasks', 'access'] as const;
