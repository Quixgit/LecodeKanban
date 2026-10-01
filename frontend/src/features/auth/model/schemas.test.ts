import { describe, expect, it } from 'vitest';
import { parseFieldMessage } from '@/shared/lib/formMessage';
import { passwordScore, registerSchema, resetSchema } from './schemas';

const issueKey = (
  r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
) => parseFieldMessage(r.error?.issues.find((i) => i.path[0] === field)?.message)?.key;

describe('registerSchema', () => {
  it('mirrors server password rules (length + 3 Unicode classes)', () => {
    const base = { name: 'Lisa', email: 'lisa@example.com' };
    expect(issueKey(registerSchema.safeParse({ ...base, password: 'Short1!' }), 'password')).toBe(
      'validation.min_length',
    );
    expect(
      issueKey(registerSchema.safeParse({ ...base, password: 'alllowercaseonly' }), 'password'),
    ).toBe('validation.password_weak');
    expect(registerSchema.safeParse({ ...base, password: 'пароль-Довгий-123' }).success).toBe(true);
  });

  it('validates required name and email format', () => {
    const r = registerSchema.safeParse({
      name: '  ',
      email: 'nope',
      password: 'Kanban-Board-2026',
    });
    expect(issueKey(r, 'name')).toBe('validation.required');
    expect(issueKey(r, 'email')).toBe('validation.email');
  });

  it('carries interpolation params in the message', () => {
    const r = registerSchema.safeParse({ name: 'x', email: 'a@b.co', password: 'Ab1' });
    const msg = r.error?.issues.find((i) => i.path[0] === 'password')?.message;
    expect(parseFieldMessage(msg)).toEqual({ key: 'validation.min_length', params: { min: 10 } });
  });
});

describe('resetSchema', () => {
  it('requires matching confirmation', () => {
    const r = resetSchema.safeParse({
      password: 'Kanban-Board-2026',
      confirm: 'Kanban-Board-2027',
    });
    expect(issueKey(r, 'confirm')).toBe('validation.passwords_mismatch');
  });
});

describe('passwordScore', () => {
  it.each([
    ['', 0],
    ['abc', 0],
    ['abcdefghij', 1],
    ['Abcdefghij1', 2],
    ['Abcdefghij1234', 3],
    ['Abcdefghij12!@', 4],
  ])('%s → %i', (pw, score) => expect(passwordScore(pw)).toBe(score));
});
