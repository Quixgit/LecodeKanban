import {
  BellOff,
  CalendarClock,
  Car,
  CircleCheck,
  CircleMinus,
  Clock,
  Coffee,
  Headphones,
  House,
  Plane,
  Thermometer,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { ChatStatus } from '../api/chatApi';

export type StatusKind = ChatStatus['kind'];
export type StatusIconKey = NonNullable<ChatStatus['icon']>;

/** Icons a status can carry: outline icons in the product's own style. */
export const STATUS_ICONS: Record<StatusIconKey, LucideIcon> = {
  'calendar-clock': CalendarClock,
  headphones: Headphones,
  coffee: Coffee,
  utensils: Utensils,
  car: Car,
  house: House,
  plane: Plane,
  thermometer: Thermometer,
};
export const STATUS_ICON_KEYS = Object.keys(STATUS_ICONS) as StatusIconKey[];

export const KIND_ICONS: Record<StatusKind, LucideIcon> = {
  available: CircleCheck,
  busy: CircleMinus,
  dnd: BellOff,
  away: Clock,
};
export const STATUS_KINDS: StatusKind[] = ['available', 'busy', 'dnd', 'away'];

/** Ready-made statuses, like Slack's suggestions. The label key lives under status.presets. */
export const PRESETS: { id: string; kind: StatusKind; icon: StatusIconKey; clear: ClearAfter }[] = [
  { id: 'meeting', kind: 'busy', icon: 'calendar-clock', clear: '1h' },
  { id: 'focus', kind: 'dnd', icon: 'headphones', clear: '4h' },
  { id: 'lunch', kind: 'away', icon: 'utensils', clear: '1h' },
  { id: 'break', kind: 'away', icon: 'coffee', clear: '30m' },
  { id: 'commuting', kind: 'away', icon: 'car', clear: '1h' },
  { id: 'remote', kind: 'available', icon: 'house', clear: 'today' },
  { id: 'sick', kind: 'away', icon: 'thermometer', clear: 'today' },
  { id: 'vacation', kind: 'away', icon: 'plane', clear: 'week' },
];

export type ClearAfter = 'never' | '30m' | '1h' | '4h' | 'today' | 'week';
export const CLEAR_OPTIONS: ClearAfter[] = ['never', '30m', '1h', '4h', 'today', 'week'];

/** When a status ends, as an ISO time (or undefined to keep it until changed). */
export function untilFor(after: ClearAfter, now = new Date()): string | undefined {
  const d = new Date(now);
  switch (after) {
    case 'never':
      return undefined;
    case '30m':
      d.setMinutes(d.getMinutes() + 30);
      break;
    case '1h':
      d.setHours(d.getHours() + 1);
      break;
    case '4h':
      d.setHours(d.getHours() + 4);
      break;
    case 'today':
      d.setHours(23, 59, 0, 0);
      if (d.getTime() - now.getTime() < 60_000) d.setDate(d.getDate() + 1); // too close to midnight
      break;
    case 'week':
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      break;
  }
  return d.toISOString();
}

/** What a person's dot should show: their chosen availability, else online / offline. */
export type Presence = 'online' | 'busy' | 'dnd' | 'away' | 'offline';
export function presenceOf(online: boolean, status?: ChatStatus): Presence {
  if (status && status.kind !== 'available') return status.kind;
  return online ? 'online' : 'offline';
}
