import {
  BookOpen,
  Download,
  KeyRound,
  LayoutGrid,
  MessagesSquare,
  Plug,
  type LucideIcon,
} from 'lucide-react';

/** The guides and their articles. Titles, summaries and steps live in the help translations. */
export interface GuideDef {
  id: string;
  icon: LucideIcon;
  articles: readonly string[];
}

export const GUIDES: readonly GuideDef[] = [
  { id: 'tasks', icon: LayoutGrid, articles: ['board', 'details', 'find', 'trash'] },
  { id: 'chat', icon: MessagesSquare, articles: ['channels', 'threads'] },
  { id: 'docs', icon: BookOpen, articles: ['write', 'organise'] },
  { id: 'integrations', icon: Plug, articles: ['calendar', 'github'] },
  { id: 'roles', icon: KeyRound, articles: ['permissions', 'security', 'notifications'] },
  { id: 'export', icon: Download, articles: ['tasks', 'docs'] },
];

export function findGuide(id: string | null | undefined): GuideDef | undefined {
  return GUIDES.find((g) => g.id === id);
}
