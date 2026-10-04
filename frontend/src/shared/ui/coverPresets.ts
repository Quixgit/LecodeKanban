/** Ready-made profile backgrounds, drawn from the design tokens. The ids match the server's list. */
export const COVER_PRESETS = {
  aurora: 'from-done/60 via-primary/40 to-review/50',
  ocean: 'from-primary/50 to-done/40',
  sunset: 'from-progress/60 to-danger/40',
  forest: 'from-done/70 to-done/30',
  lavender: 'from-review/50 to-primary/30',
  slate: 'from-text-muted/30 to-text-faint/20',
  dawn: 'from-danger/30 via-progress/40 to-review/30',
  mint: 'from-done/30 to-primary-subtle',
} as const;

export type CoverPreset = keyof typeof COVER_PRESETS;
export const COVER_PRESET_IDS = Object.keys(COVER_PRESETS) as CoverPreset[];

export const isCoverPreset = (v: string): v is CoverPreset => v in COVER_PRESETS;
