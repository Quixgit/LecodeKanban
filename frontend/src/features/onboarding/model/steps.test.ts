import { describe, expect, it } from 'vitest';
import { isOptional, progress, stepsFor } from './steps';

describe('wizard steps', () => {
  it('a new person sets up a workspace; an invited one only introduces themselves', () => {
    expect(stepsFor('create')).toContain('workspace');
    expect(stepsFor('create')).toContain('team');
    expect(stepsFor('join')).not.toContain('workspace');
    expect(stepsFor('join')).not.toContain('team');
  });
  it('both end on the done step', () => {
    expect(stepsFor('create').at(-1)).toBe('done');
    expect(stepsFor('join').at(-1)).toBe('done');
  });
  it('only the workspace name and the screens around it cannot be skipped', () => {
    expect(isOptional('workspace')).toBe(false);
    expect(isOptional('welcome')).toBe(false);
    expect(isOptional('photo')).toBe(true);
  });
  it('progress runs from 0 to 100', () => {
    expect(progress('create', 'welcome')).toBe(0);
    expect(progress('create', 'done')).toBe(100);
    expect(progress('join', 'photo')).toBe(50);
  });
});
