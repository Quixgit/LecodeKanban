import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, CalendarDays, Mail, MailWarning, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import { applyServerFieldErrors } from '@/shared/lib/serverErrors';
import { Button, Field, Input, Pill, toast } from '@/shared/ui';
import { settingsApi } from '../api/settingsApi';
import { useProfileMutations } from '../hooks/useSettings';
import { nameSchema, type NameValues } from '../model/schemas';
import { AvatarEditor } from './AvatarEditor';
import { SettingsCard } from './SettingsLayout';

const PROVIDERS = ['google', 'github'] as const;

/** Photo, name and the account's email and sign-in methods. */
export function ProfilePage() {
  const { t } = useTranslation('settings');
  const fe = useFieldError();
  const errorText = useErrorText();
  const { language } = useLanguage();
  const { user } = useSession();
  const { rename } = useProfileMutations();
  const form = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    values: { name: user?.name ?? '' },
    mode: 'onTouched',
  });
  if (!user) return null;

  const dirty = form.formState.isDirty;
  const save = form.handleSubmit((v) =>
    rename.mutate(v.name, {
      onSuccess: (u) => {
        form.reset({ name: u.name });
        toast.success(t('profile.saved'));
      },
      onError: (e) => applyServerFieldErrors(e, form.setError, ['name']),
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('avatar.title')} description={t('avatar.description')}>
        <AvatarEditor user={user} />
      </SettingsCard>

      <form onSubmit={save} noValidate>
        <SettingsCard
          title={t('profile.title')}
          description={t('profile.description')}
          footer={
            <>
              {dirty && (
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
                  {t('profile.reset')}
                </Button>
              )}
              <Button type="submit" loading={rename.isPending} disabled={!dirty}>
                {t('profile.save')}
              </Button>
            </>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('profile.name')} error={fe(form.formState.errors.name?.message)}>
              <Input
                autoComplete="name"
                leadingIcon={<UserRound />}
                maxLength={100}
                {...form.register('name')}
              />
            </Field>
            <Field
              label={t('profile.email')}
              hint={user.emailVerified ? undefined : t('profile.emailUnverifiedHint')}
            >
              <Input value={user.email} readOnly leadingIcon={<Mail />} aria-readonly />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {user.emailVerified ? (
              <Pill tone="teal" icon={<BadgeCheck />} size="sm">
                {t('profile.verified')}
              </Pill>
            ) : (
              <>
                <Pill tone="amber" icon={<MailWarning />} size="sm">
                  {t('profile.unverified')}
                </Pill>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    settingsApi
                      .resendVerification()
                      .then(() =>
                        toast.success(t('profile.verificationSent', { email: user.email })),
                      )
                      .catch((e) => toast.error(errorText(e)))
                  }
                >
                  {t('profile.resend')}
                </Button>
              </>
            )}
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <CalendarDays className="size-3.5" aria-hidden />
              {t('profile.memberSince', { date: formatDate(user.createdAt, language) })}
            </span>
          </div>
        </SettingsCard>
      </form>

      <SettingsCard title={t('signin.title')} description={t('signin.description')}>
        <ul className="divide-y divide-border-subtle">
          <li className="flex items-center justify-between gap-4 py-3 first:pt-0">
            <span className="text-sm font-medium text-text">{t('signin.password')}</span>
            <Pill tone={user.hasPassword ? 'teal' : 'neutral'} size="sm">
              {user.hasPassword ? t('signin.set') : t('signin.notSet')}
            </Pill>
          </li>
          {PROVIDERS.map((p) => (
            <li key={p} className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <span className="text-sm font-medium text-text">{t(`signin.${p}`)}</span>
              <Pill tone={user.providers.includes(p) ? 'teal' : 'neutral'} size="sm">
                {user.providers.includes(p) ? t('signin.linked') : t('signin.notLinked')}
              </Pill>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}
