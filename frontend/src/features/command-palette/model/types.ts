import type { LucideIcon } from 'lucide-react';

export interface Command {
  id: string;
  /** Already-translated label. */
  label: string;
  group: string;
  icon: LucideIcon;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
}
