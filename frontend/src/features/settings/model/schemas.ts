import { z } from 'zod';
import { passwordSchema } from '@/features/auth';
import { fieldMessage } from '@/shared/lib/formMessage';

const required = fieldMessage('validation.required');

export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, required)
    .max(100, fieldMessage('validation.max_length', { max: 100 })),
});
export type NameValues = z.infer<typeof nameSchema>;

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
