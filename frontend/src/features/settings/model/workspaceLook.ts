import {
  Briefcase,
  Building2,
  FlaskConical,
  Flame,
  Globe,
  Layers,
  Leaf,
  Rocket,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceSettings } from '../api/settingsApi';

export type WorkspaceIcon = WorkspaceSettings['icon'];

/** The glyphs a workspace can wear (the server accepts exactly these names). */
export const WORKSPACE_ICONS: Record<WorkspaceIcon, LucideIcon> = {
  building: Building2,
  rocket: Rocket,
  briefcase: Briefcase,
  layers: Layers,
  globe: Globe,
  flask: FlaskConical,
  shield: ShieldCheck,
  sparkles: Sparkles,
  leaf: Leaf,
  flame: Flame,
};

/** Ready-made accents: the platform's own (empty) and a few that read well on white and on dark. */
export const ACCENTS: readonly string[] = [
  '',
  '#2f7bd9',
  '#6b4fd8',
  '#c2410c',
  '#be185d',
  '#15803d',
  '#b45309',
  '#475569',
];
