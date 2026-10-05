import { z } from 'zod';
import { passwordSchema } from '@/features/auth';
import { fieldMessage } from '@/shared/lib/formMessage';

const required = fieldMessage('validation.required');

const optional = (max: number) =>
  z.string().trim().max(max, fieldMessage('validation.max_length', { max }));

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, required)
    .max(100, fieldMessage('validation.max_length', { max: 100 })),
  jobTitle: optional(100),
  phone: optional(40),
  location: optional(100),
  timezone: optional(64),
  bio: optional(500),
  pronouns: optional(30),
  linkedin: optional(200),
  telegram: optional(64),
  whatsapp: optional(40),
  website: optional(200),
  workStart: z.string(),
  workEnd: z.string(),
  skills: z.array(z.string().trim().max(30)).max(10),
});
export type ProfileValues = z.infer<typeof profileSchema>;

/** The current password is asked for only when the account already has one. */
export const changePasswordSchema = (hasPassword: boolean) =>
  z
    .object({
      current: z.string(),
      password: passwordSchema,
      confirm: z.string().min(1, required),
    })
    .superRefine((v, ctx) => {
      if (hasPassword && !v.current)
        ctx.addIssue({ code: 'custom', path: ['current'], message: required });
      if (v.password !== v.confirm) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirm'],
          message: fieldMessage('validation.passwords_mismatch'),
        });
      }
    });
export type ChangePasswordValues = z.infer<ReturnType<typeof changePasswordSchema>>;
