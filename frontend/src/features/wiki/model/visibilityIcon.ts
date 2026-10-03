import { Globe, Lock, Users, type LucideIcon } from 'lucide-react';
import type { WikiVisibility } from './tree';

export const visibilityIcon: Record<WikiVisibility, LucideIcon> = {
  private: Lock,
  shared: Users,
  workspace: Globe,
};
