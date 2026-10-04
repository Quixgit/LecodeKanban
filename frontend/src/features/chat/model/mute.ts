/** Ways to silence a channel for a while, as the end time (ISO) counted from `now`. */
export type MutePreset = 'hour' | 'fourHours' | 'tomorrow' | 'nextWeek';

export const MUTE_PRESETS: readonly MutePreset[] = ['hour', 'fourHours', 'tomorrow', 'nextWeek'];

/** "Until tomorrow" means tomorrow 9:00, "until next week" the coming Monday 9:00, local time. */
export function muteUntil(preset: MutePreset, now: Date = new Date()): string {
  const at = new Date(now);
  switch (preset) {
    case 'hour':
      at.setHours(at.getHours() + 1);
      break;
    case 'fourHours':
      at.setHours(at.getHours() + 4);
      break;
    case 'tomorrow':
      at.setDate(at.getDate() + 1);
      at.setHours(9, 0, 0, 0);
      break;
    case 'nextWeek': {
      const toMonday = (8 - at.getDay()) % 7 || 7;
      at.setDate(at.getDate() + toMonday);
      at.setHours(9, 0, 0, 0);
      break;
    }
  }
  return at.toISOString();
}
