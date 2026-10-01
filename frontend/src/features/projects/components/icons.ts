import {
  Code2,
  FlaskConical,
  FolderKanban,
  Globe,
  Layers,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectIcon } from '../api/projectsApi';

export const projectIcons: Record<ProjectIcon, LucideIcon> = {
  folder: FolderKanban,
  rocket: Rocket,
  shield: ShieldCheck,
  code: Code2,
  target: Target,
  sparkles: Sparkles,
  globe: Globe,
  megaphone: Megaphone,
  layers: Layers,
  flask: FlaskConical,
};
