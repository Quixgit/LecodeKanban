import type { WorkspaceSettings } from '../api/settingsApi';

export type StepKey = 'describe' | 'look' | 'invite' | 'email' | 'roles' | 'fields' | 'labels';

export interface SetupInput {
  settings: WorkspaceSettings;
  members: number;
  /** Undefined while unknown (still loading, or not allowed to see it). */
  emailLive?: boolean;
  customRoles?: number;
  changedRoles?: number;
  fields?: number;
  labels?: number;
}

export interface Step {
  key: StepKey;
  to: string;
  /** undefined: not known yet, shown neither as done nor as open. */
  done: boolean | undefined;
}

/** The first things an administrator does with a new workspace, and which of them are done. */
export function setupSteps(i: SetupInput): Step[] {
  const known = (v: number | undefined, test: (n: number) => boolean) =>
    v === undefined ? undefined : test(v);
  return [
    { key: 'describe', to: '/settings/general', done: i.settings.description.trim() !== '' },
    {
      key: 'look',
      to: '/settings/general',
      done: i.settings.accentColor !== '' || i.settings.icon !== 'building',
    },
    { key: 'invite', to: '/team', done: i.members > 1 },
    { key: 'email', to: '/settings/email', done: i.emailLive },
    {
      key: 'roles',
      to: '/settings/roles',
      done:
        i.customRoles === undefined && i.changedRoles === undefined
          ? undefined
          : (i.customRoles ?? 0) + (i.changedRoles ?? 0) > 0,
    },
    { key: 'fields', to: '/settings/fields', done: known(i.fields, (n) => n > 0) },
    { key: 'labels', to: '/settings/labels', done: known(i.labels, (n) => n > 0) },
  ];
}

/** Percent of known steps that are done. */
export function setupProgress(steps: Step[]): number {
  const known = steps.filter((s) => s.done !== undefined);
  if (known.length === 0) return 0;
  return Math.round((known.filter((s) => s.done).length / known.length) * 100);
}
