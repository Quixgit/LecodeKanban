import type { Transition, Variants } from 'framer-motion';

/** Global easing — matches --ease-out in tokens.css. */
export const ease = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds (framer-motion units). */
export const duration = {
  micro: 0.14,
  ui: 0.22,
  large: 0.32,
} as const;

export const stagger = 0.035;

export const transition = {
  micro: { duration: duration.micro, ease },
  ui: { duration: duration.ui, ease },
  large: { duration: duration.large, ease },
  /** Physical settle (drop, toast stacking, layout reflow). */
  spring: { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 },
  softSpring: { type: 'spring', stiffness: 320, damping: 32 },
} satisfies Record<string, Transition>;

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.ui },
  exit: { opacity: 0, transition: transition.micro },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transition.ui },
  exit: { opacity: 0, y: 4, transition: transition.micro },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: transition.large },
  exit: { opacity: 0, transition: { duration: duration.micro, ease } },
};

export const listContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
};

export const listItem: Variants = fadeUp;

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: transition.ui },
  exit: { opacity: 0, scale: 0.98, transition: transition.micro },
};

export const drawerRight: Variants = {
  hidden: { x: '100%', opacity: 0.6 },
  visible: { x: 0, opacity: 1, transition: transition.large },
  exit: { x: '100%', opacity: 0.6, transition: transition.ui },
};

export const drawerLeft: Variants = {
  hidden: { x: '-100%', opacity: 0.6 },
  visible: { x: 0, opacity: 1, transition: transition.large },
  exit: { x: '-100%', opacity: 0.6, transition: transition.ui },
};

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.ui },
  exit: { opacity: 0, transition: transition.ui },
};

/** Kanban card lift while dragging. */
export const dragLift = {
  scale: 1.02,
  rotate: 1.5,
  boxShadow: 'var(--sh-drag)',
} as const;

/** Height collapse/expand for submenus and deletions. */
export const collapse: Variants = {
  collapsed: { height: 0, opacity: 0, transition: transition.ui },
  expanded: { height: 'auto', opacity: 1, transition: transition.ui },
};

/** List entries fade + slide in; removed ones collapse their height (trash rows, tree children). */
export const itemPresence: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, height: 'auto', transition: transition.ui },
  exit: { opacity: 0, height: 0, marginBottom: 0, transition: transition.ui },
};
