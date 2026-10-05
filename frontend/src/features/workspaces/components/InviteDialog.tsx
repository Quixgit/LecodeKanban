import { copyText } from '@/shared/lib/clipboard';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Mail } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { InviteRole, Role, Workspace } from '@/shared/api';
import { isApiError } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { fieldMessage } from '@/shared/lib/formMessage';
import { Button, Field, FormAlert, Input, Modal, Select, toast } from '@/shared/ui';
import { useWorkspaceMutations } from '../hooks/useWorkspaces';
import { invitableRoles } from '../model/permissions';

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, fieldMessage('validation.required'))
    .email(fieldMessage('validation.email')),
  role: z.enum(['admin', 'member', 'viewer']),
});
type Values = z.infer<typeof schema>;

export function InviteDialog({
  open,
  onOpenChange,
  workspace,
  actorRole,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspace: Workspace;
  actorRole: Role;
}) {
  const { t } = useTranslation('team');
  const fe = useFieldError();
  const errorText = useErrorText();
  const { invite } = useWorkspaceMutations(workspace.id);
  const roles = invitableRoles(actorRole);
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      form.reset();
      invite.reset();
      setSent(null);
    }
  };

  const onSubmit = form.handleSubmit((v) =>
    invite.mutate(
      { email: v.email, role: v.role as InviteRole },
      {
        onSuccess: (inv) => {
          toast.success(t('invite.sent', { email: v.email }));
          // Email can fail to arrive; the link lets the admin hand it over some other way.
          if (inv?.link) setSent({ email: v.email, link: inv.link });
          else close(false);
        },
        onError: (err) => {
          const f = isApiError(err) ? err.field('email') : undefined;
          if (f)
            form.setError('email', {
              message: fieldMessage(`validation.${f.code}`, f.params ?? undefined),
            });
        },
      },
    ),
  );

  const generalError =
    invite.error && !(isApiError(invite.error) && invite.error.field('email'))
      ? errorText(invite.error)
      : null;

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={t('invite.title', { workspace: workspace.name })}
      description={t('invite.description')}
      footer={
        sent ? (
          <Button onClick={() => close(false)}>{t('invite.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" form="invite-form" loading={invite.isPending}>
              {t('invite.submit')}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text">{t('invite.sent', { email: sent.email })}</p>
          <p className="text-sm text-text-muted">{t('invite.linkHint')}</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={sent.link}
              aria-label={t('invite.link')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              onClick={() =>
                void copyText(sent.link).then((ok) =>
                  ok ? toast.success(t('invite.copied')) : toast.error(t('invite.copyFailed')),
                )
              }
            >
              <Copy />
              {t('invite.copy')}
            </Button>
          </div>
        </div>
      ) : (
        <form id="invite-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormAlert>{generalError}</FormAlert>
          <Field label={t('invite.email')} error={fe(form.formState.errors.email?.message)}>
            <Input
              type="email"
              autoFocus
              leadingIcon={<Mail />}
              placeholder="teammate@company.com"
              {...form.register('email')}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text" id="invite-role-label">
              {t('invite.role')}
            </span>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  label={t('invite.role')}
                  value={field.value}
                  onValueChange={field.onChange}
                  className="w-full justify-between"
                  options={roles.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
                />
              )}
            />
            <p className="text-xs text-text-muted">{t(`roleHints.${form.watch('role')}`)}</p>
          </div>
        </form>
      )}
    </Modal>
  );
}
