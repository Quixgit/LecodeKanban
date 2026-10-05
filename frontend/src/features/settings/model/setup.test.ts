import { describe, expect, it } from 'vitest';
import type { WorkspaceSettings } from '../api/settingsApi';
import { setupProgress, setupSteps } from './setup';

const base = {
  description: '',
  accentColor: '',
  icon: 'building',
} as unknown as WorkspaceSettings;

describe('admin set-up steps', () => {
  it('starts with a lone owner and an untouched workspace', () => {
    const steps = setupSteps({ settings: base, members: 1 });
    expect(steps.find((s) => s.key === 'describe')?.done).toBe(false);
    expect(steps.find((s) => s.key === 'invite')?.done).toBe(false);
    // What is not known yet is neither done nor open.
    expect(steps.find((s) => s.key === 'fields')?.done).toBeUndefined();
  });

  it('counts a look chosen, people invited and fields defined', () => {
    const steps = setupSteps({
      settings: { ...base, description: 'Our studio', icon: 'rocket' },
      members: 3,
      emailLive: true,
      fields: 2,
      labels: 0,
      customRoles: 0,
      changedRoles: 0,
    });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toMatchObject({
      describe: true,
      look: true,
      invite: true,
      email: true,
      fields: true,
      labels: false,
      roles: false,
    });
    expect(setupProgress(steps)).toBe(71);
  });

  it('measures progress over the known steps only', () => {
    expect(setupProgress(setupSteps({ settings: base, members: 1 }))).toBe(0);
  });
});
