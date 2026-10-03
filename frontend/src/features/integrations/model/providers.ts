import { CalendarClock, type LucideIcon } from 'lucide-react';
import type { Provider } from '../api/integrationsApi';

/** What the page needs to know about each provider besides what the server tells it. */
export const PROVIDERS: Record<Provider, { icon: LucideIcon; redirectStep: number }> = {
  // redirectStep: which setup step shows the address to register (0-based).
  google_calendar: { icon: CalendarClock, redirectStep: 2 },
};

/** Where a provider is, in the words the tile uses. */
export type Standing = 'needsSetup' | 'off' | 'reconnect' | 'paused' | 'active';

export function standing(e: {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  status: string;
}): Standing {
  if (!e.configured) return 'needsSetup';
  if (!e.connected) return 'off';
  if (e.status === 'error') return 'reconnect';
  return e.enabled ? 'active' : 'paused';
}
