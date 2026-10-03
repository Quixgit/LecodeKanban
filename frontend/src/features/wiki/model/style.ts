import type { Tone } from '@/shared/ui';

/** Space accent colours: semantic tones, so every theme stays consistent. */
export const SPACE_TONES: readonly Tone[] = ['teal', 'amber', 'purple', 'red', 'neutral'];

export const isTone = (v: string): v is Tone => (SPACE_TONES as readonly string[]).includes(v);
export const toneOf = (v: string | undefined): Tone => (v && isTone(v) ? v : 'teal');
