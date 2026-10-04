import { CalendarDays, CheckSquare, Hash, Link2, List, Type, type LucideIcon } from 'lucide-react';
import type { CustomFieldKind } from '../api/fieldsApi';

export const KINDS: readonly CustomFieldKind[] = [
  'text',
  'number',
  'select',
  'date',
  'checkbox',
  'url',
];

export const KIND_ICONS: Record<CustomFieldKind, LucideIcon> = {
  text: Type,
  number: Hash,
  select: List,
  date: CalendarDays,
  checkbox: CheckSquare,
  url: Link2,
};

export const TONES = ['neutral', 'teal', 'amber', 'purple', 'red'] as const;
