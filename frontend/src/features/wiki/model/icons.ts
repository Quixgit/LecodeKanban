import {
  BookOpen,
  Briefcase,
  ClipboardList,
  Code,
  Compass,
  Database,
  FlaskConical,
  Globe,
  Handshake,
  Layers,
  LifeBuoy,
  Lightbulb,
  Lock,
  Network,
  Rocket,
  Server,
  ShieldCheck,
  Siren,
  Target,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons a space can use. A space stores the key (not an image or emoji), so the whole product
 * keeps one outline icon style. Unknown keys fall back to the default.
 */
export const WIKI_ICONS = {
  'book-open': BookOpen,
  siren: Siren,
  rocket: Rocket,
  'shield-check': ShieldCheck,
  lock: Lock,
  handshake: Handshake,
  'trending-up': TrendingUp,
  compass: Compass,
  wrench: Wrench,
  server: Server,
  database: Database,
  network: Network,
  users: Users,
  lightbulb: Lightbulb,
  target: Target,
  'flask-conical': FlaskConical,
  layers: Layers,
  globe: Globe,
  code: Code,
  'life-buoy': LifeBuoy,
  'clipboard-list': ClipboardList,
  briefcase: Briefcase,
} as const satisfies Record<string, LucideIcon>;

export type WikiIconKey = keyof typeof WIKI_ICONS;
export const WIKI_ICON_KEYS = Object.keys(WIKI_ICONS) as WikiIconKey[];
export const DEFAULT_SPACE_ICON: WikiIconKey = 'book-open';

export const isIconKey = (v: string | undefined): v is WikiIconKey => !!v && v in WIKI_ICONS;

/** The Lucide component for a stored key, or undefined when unset/unknown. */
export const iconFor = (key: string | undefined): LucideIcon | undefined =>
  isIconKey(key) ? WIKI_ICONS[key] : undefined;
