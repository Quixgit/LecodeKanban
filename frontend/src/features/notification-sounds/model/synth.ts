export type SoundKind = 'message' | 'mention' | 'task' | 'notify';

/** Higher number wins when several sounds are due at once. */
export const PRIORITY: Record<SoundKind, number> = { notify: 1, task: 2, message: 3, mention: 4 };

export function strongest(kinds: readonly SoundKind[]): SoundKind | undefined {
  return [...kinds].sort((a, b) => PRIORITY[b] - PRIORITY[a])[0];
}

interface Note {
  /** Hz */
  f: number;
  /** seconds after the start */
  at: number;
  /** seconds the note rings */
  len: number;
  gain: number;
  type?: OscillatorType;
}

/**
 * The sounds are synthesised, so there are no audio files to ship: soft sine "bells" with a quiet
 * octave overtone, a short attack and an exponential decay, played through a gentle echo.
 */
const SCORES: Record<SoundKind, Note[]> = {
  // Two soft notes rising a fourth: a polite tap on the shoulder.
  message: [
    { f: 659.25, at: 0, len: 0.2, gain: 0.5 },
    { f: 880, at: 0.09, len: 0.34, gain: 0.55 },
  ],
  // A brighter rising arpeggio: someone addressed you.
  mention: [
    { f: 523.25, at: 0, len: 0.22, gain: 0.5 },
    { f: 659.25, at: 0.08, len: 0.22, gain: 0.5 },
    { f: 783.99, at: 0.16, len: 0.22, gain: 0.5 },
    { f: 1046.5, at: 0.24, len: 0.55, gain: 0.55 },
  ],
  // A marimba-like pair: a new task landed on the board.
  task: [
    { f: 392, at: 0, len: 0.16, gain: 0.55, type: 'triangle' },
    { f: 587.33, at: 0.11, len: 0.3, gain: 0.55, type: 'triangle' },
  ],
  // A single clear bell.
  notify: [{ f: 783.99, at: 0, len: 0.5, gain: 0.5 }],
};

let ctx: AudioContext | null = null;
let unlocked = false;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Browsers only allow audio after a user gesture. Call once at start: the first click or key press
 * creates and resumes the audio context.
 */
export function unlockAudioOnGesture(): () => void {
  const unlock = () => {
    const c = context();
    if (c && c.state === 'suspended') void c.resume();
    unlocked = true;
    off();
  };
  const off = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  return off;
}

/** Plays a sound at the given volume (0–1). Silently does nothing if audio is not available yet. */
export function playSound(kind: SoundKind, volume: number): void {
  const c = context();
  if (!c || !unlocked || volume <= 0) return;
  if (c.state === 'suspended') void c.resume();
  const t0 = c.currentTime + 0.02;
  const master = c.createGain();
  master.gain.value = Math.min(1, Math.max(0, volume)) * 0.35;
  // A soft echo gives the notes some air.
  const echo = c.createDelay(0.5);
  echo.delayTime.value = 0.13;
  const feedback = c.createGain();
  feedback.gain.value = 0.22;
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 4200;
  echo.connect(feedback).connect(echo);
  echo.connect(tone);
  master.connect(tone);
  master.connect(echo);
  tone.connect(c.destination);

  for (const n of SCORES[kind]) {
    for (const [mult, level] of [
      [1, 1],
      [2, 0.18],
    ] as const) {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.f * mult;
      const start = t0 + n.at;
      const peak = n.gain * level;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, start + n.len);
      osc.connect(env).connect(master);
      osc.start(start);
      osc.stop(start + n.len + 0.05);
    }
  }
  // Release the graph once the last note and its echoes have faded.
  window.setTimeout(() => {
    master.disconnect();
    echo.disconnect();
    tone.disconnect();
  }, 2500);
}
