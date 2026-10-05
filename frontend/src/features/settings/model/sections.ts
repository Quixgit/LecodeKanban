import {
  Blocks,
  FileSpreadsheet,
  Flag,
  KeyRound,
  History,
  Mail,
  LayoutDashboard,
  ListPlus,
  SlidersHorizontal,
  Tags,
  ToggleRight,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type SectionKey =
  | 'overview'
  | 'general'
  | 'features'
  | 'access'
  | 'roles'
  | 'members'
  | 'rules'
  | 'fields'
  | 'labels'
  | 'integrations'
  | 'audit'
  | 'email'
  | 'data';

export interface Section {
  key: SectionKey;
  to: string;
  icon: LucideIcon;
  group: 'workspace' | 'people' | 'work' | 'system';
  /** Sections that live on another page of the app open it instead of a settings page. */
  external?: boolean;
}

export const SECTIONS: readonly Section[] = [
  { key: 'overview', to: '/settings', icon: LayoutDashboard, group: 'workspace' },
  { key: 'general', to: '/settings/general', icon: SlidersHorizontal, group: 'workspace' },
  { key: 'features', to: '/settings/features', icon: ToggleRight, group: 'workspace' },
  { key: 'access', to: '/settings/access', icon: UserCog, group: 'people' },
  { key: 'roles', to: '/settings/roles', icon: KeyRound, group: 'people' },
  { key: 'members', to: '/team', icon: Users, group: 'people', external: true },
  { key: 'rules', to: '/settings/rules', icon: Flag, group: 'work' },
  { key: 'fields', to: '/settings/fields', icon: ListPlus, group: 'work' },
  { key: 'labels', to: '/settings/labels', icon: Tags, group: 'work' },
  { key: 'integrations', to: '/integrations', icon: Blocks, group: 'work', external: true },
  { key: 'data', to: '/settings/data', icon: FileSpreadsheet, group: 'system' },
  { key: 'email', to: '/settings/email', icon: Mail, group: 'system' },
  { key: 'audit', to: '/settings/audit', icon: History, group: 'system' },
];

export const GROUPS = ['workspace', 'people', 'work', 'system'] as const;
