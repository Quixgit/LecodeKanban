import { Check, TriangleAlert, Unplug, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Standing } from '../model/providers';

export const STANDING_PILL: Record<
  Standing,
  { tone: 'neutral' | 'teal' | 'red' | 'amber'; icon: ReactNode }
> = {
  needsSetup: { tone: 'amber', icon: <Wrench /> },
  off: { tone: 'neutral', icon: <Unplug /> },
  reconnect: { tone: 'red', icon: <TriangleAlert /> },
  paused: { tone: 'neutral', icon: <Unplug /> },
  active: { tone: 'teal', icon: <Check /> },
};
