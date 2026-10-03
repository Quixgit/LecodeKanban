import {
  ArrowRightLeft,
  AtSign,
  CalendarClock,
  MessageSquare,
  PencilLine,
  Send,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { AppNotification, NotificationKind } from '../api/notificationsApi';

export const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  assigned: UserPlus,
  task_moved: ArrowRightLeft,
  task_updated: PencilLine,
  task_commented: MessageSquare,
  mention: AtSign,
  dm: Send,
  meeting: CalendarClock,
};

/** Where a notification leads: a task's window, or a conversation. */
export type Target = { card: string } | { channel: string } | { link: string } | null;

export function targetOf(n: AppNotification): Target {
  if (n.cardId) return { card: n.cardId };
  if (n.channelId) return { channel: n.channelId };
  if (n.link) return { link: n.link };
  return null;
}

/** Sounds the bell adds on top of the chat list's own: tasks only (chat sounds follow the list). */
export function soundFor(n: AppNotification): 'task' | 'notify' | undefined {
  switch (n.kind) {
    case 'assigned':
      return 'task';
    case 'task_moved':
    case 'task_updated':
    case 'task_commented':
    case 'meeting':
      return 'notify';
    default:
      return undefined;
  }
}

/** Ids that appeared since the previous snapshot (empty on the first one, which is the baseline). */
export function freshIds(previous: ReadonlySet<string> | null, items: readonly AppNotification[]) {
  if (!previous) return [];
  return items.filter((n) => !n.read && !previous.has(n.id)).map((n) => n.id);
}
