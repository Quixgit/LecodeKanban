import { z } from 'zod';
import { fieldMessage } from '@/shared/lib/formMessage';

const required = fieldMessage('validation.required');

const email = z.string().trim().min(1, required).email(fieldMessage('validation.email'));

/** Mirrors the server rule: 10–128 chars and ≥3 character classes (Unicode-aware). */
export const password = z
  .string()
  .min(1, required)
  .min(10, fieldMessage('validation.min_length', { min: 10 }))
  .max(128, fieldMessage('validation.max_length', { max: 128 }))
  .refine((v) => passwordClasses(v) >= 3, fieldMessage('validation.password_weak'));

export function passwordClasses(v: string): number {
  let lower = false;
  let upper = false;
  let digit = false;
  let other = false;
  for (const ch of v) {
    if (/\p{Ll}/u.test(ch)) lower = true;
    else if (/\p{Lu}/u.test(ch)) upper = true;
    else if (/\p{Nd}/u.test(ch)) digit = true;
    else other = true;
  }
  return [lower, upper, digit, other].filter(Boolean).length;
}

/** 0–4 score for the strength meter. */
export function passwordScore(v: string): number {
  if (!v) return 0;
  const classes = passwordClasses(v);
  let score = 0;
  if (v.length >= 10) score++;
  if (v.length >= 14) score++;
  if (classes >= 3) score++;
  if (classes === 4) score++;
  return Math.min(score, 4);
}

export const loginSchema = z.object({ email, password: z.string().min(1, required) });
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, required)
    .max(100, fieldMessage('validation.max_length', { max: 100 })),
  email,
  password,
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotSchema = z.object({ email });
export type ForgotValues = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({ password, confirm: z.string().min(1, required) })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: fieldMessage('validation.passwords_mismatch'),
  });
export type ResetValues = z.infer<typeof resetSchema>;
