import {
  CircleCheck,
  Eye,
  Flame,
  Heart,
  Laugh,
  Lightbulb,
  PartyPopper,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';

/** Reactions are a closed set of outline icons (the product uses no emoji). Keep in sync with the API. */
export const REACTION_KEYS = [
  'thumbs-up',
  'heart',
  'check',
  'party-popper',
  'eyes',
  'laugh',
  'flame',
  'lightbulb',
] as const;

/** A built-in icon key or an emoji. */
export type ReactionKey = string;
type IconKey = (typeof REACTION_KEYS)[number];

export const REACTION_ICONS: Record<IconKey, LucideIcon> = {
  'thumbs-up': ThumbsUp,
  heart: Heart,
  check: CircleCheck,
  'party-popper': PartyPopper,
  eyes: Eye,
  laugh: Laugh,
  flame: Flame,
  lightbulb: Lightbulb,
};

export function isIconKey(key: string): key is IconKey {
  return (REACTION_KEYS as readonly string[]).includes(key);
}
