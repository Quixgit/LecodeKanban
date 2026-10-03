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

export type ReactionKey = (typeof REACTION_KEYS)[number];

export const REACTION_ICONS: Record<ReactionKey, LucideIcon> = {
  'thumbs-up': ThumbsUp,
  heart: Heart,
  check: CircleCheck,
  'party-popper': PartyPopper,
  eyes: Eye,
  laugh: Laugh,
  flame: Flame,
  lightbulb: Lightbulb,
};

export function isReactionKey(key: string): key is ReactionKey {
  return (REACTION_KEYS as readonly string[]).includes(key);
}
