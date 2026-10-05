/** The wizard has two shapes: someone with no workspace yet sets one up; someone who was invited only introduces themselves. */
export type Mode = 'create' | 'join';

export type StepId = 'welcome' | 'workspace' | 'about' | 'photo' | 'contacts' | 'team' | 'done';

const CREATE: readonly StepId[] = [
  'welcome',
  'workspace',
  'about',
  'photo',
  'contacts',
  'team',
  'done',
];
const JOIN: readonly StepId[] = ['welcome', 'about', 'photo', 'contacts', 'done'];

export function stepsFor(mode: Mode): readonly StepId[] {
  return mode === 'create' ? CREATE : JOIN;
}

/** Steps that may be passed over: everything except naming the workspace you are creating. */
export function isOptional(step: StepId): boolean {
  return step === 'about' || step === 'photo' || step === 'contacts' || step === 'team';
}

/** 0–100 for the progress bar: the welcome screen is the start, the last step is the end. */
export function progress(mode: Mode, step: StepId): number {
  const steps = stepsFor(mode);
  return Math.round((steps.indexOf(step) / (steps.length - 1)) * 100);
}
