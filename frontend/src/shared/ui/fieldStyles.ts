/**
 * One look for every text field: a hairline border that picks up a soft mint outline on hover and a
 * slightly stronger one while typing (the same glow as the chat composer).
 */
export const fieldSurface =
  'border bg-surface transition-[border-color,box-shadow] duration-micro ease-out';

export const fieldGlow =
  'hover:border-primary/30 hover:ring-2 hover:ring-primary/10 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15';

export const fieldGlowInvalid =
  'border-danger hover:border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/15';
