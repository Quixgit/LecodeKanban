import { zodResolver } from '@hookform/resolvers/zod';
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Clock,
  Mail,
  MailWarning,
  MapPin,
  Phone,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/features/auth';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import { applyServerFieldErrors } from '@/shared/lib/serverErrors';
import { Button, Field, Input, Pill, SettingsCard, Textarea, toast } from '@/shared/ui';
import { profileApi } from '../api/profileApi';
import { useProfileMutations } from '../hooks/useProfile';
import { deviceTimezone, TIMEZONES } from '../model/timezone';
import { profileSchema, type ProfileValues } from '../model/schemas';
import { AvatarEditor } from './AvatarEditor';

const PROVIDERS = ['google', 'github'] as const;
const FIELDS = ['name', 'jobTitle', 'phone', 'location', 'timezone', 'bio'] as const;

/** Photo, personal details, work details, and the account's email and sign-in methods. */
export function ProfilePage() {
  const { t } = useTranslation('profile');
  const fe = useFieldError();
  const errorText = useErrorText();
  const { language } = useLanguage();
  const { user } = useSession();
  const { update } = useProfileMutations();
  const initial: ProfileValues = {
    name: user?.name ?? '',
    jobTitle: user?.jobTitle ?? '',
    phone: user?.phone ?? '',
    location: user?.location ?? '',
    timezone: user?.timezone ?? '',
    bio: user?.bio ?? '',
  };
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: initial,
    mode: 'onTouched',
  });
  if (!user) return null;

  const dirty = form.formState.isDirty;
  const errors = form.formState.errors;
  const bioLength = form.watch('bio').length;
  const save = form.handleSubmit((v) =>
    update.mutate(v, {
      onSuccess: (u) => {
        form.reset({
          name: u.name,
          jobTitle: u.jobTitle,
          phone: u.phone,
          location: u.location,
          timezone: u.timezone,
          bio: u.bio,
        });
        toast.success(t('profile.saved'));
      },
      onError: (e) => applyServerFieldErrors(e, form.setError, FIELDS),
    }),
  );
  const discard = (
    <>
      {dirty && (
        <Button type="button" variant="ghost" onClick={() => form.reset()}>
          {t('profile.reset')}
        </Button>
      )}
      <Button type="submit" loading={update.isPending} disabled={!dirty}>
        {t('profile.save')}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('avatar.title')} description={t('avatar.description')}>
        <AvatarEditor user={user} />
      </SettingsCard>

      <form onSubmit={save} noValidate className="flex flex-col gap-6">
        <SettingsCard title={t('profile.title')} description={t('profile.description')}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('profile.name')} error={fe(errors.name?.message)}>
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
                    profileApi
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

        <SettingsCard
          title={t('profile.work')}
          description={t('profile.workDescription')}
          footer={discard}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('profile.jobTitle')} error={fe(errors.jobTitle?.message)}>
              <Input
                autoComplete="organization-title"
                leadingIcon={<Briefcase />}
                placeholder={t('profile.jobTitlePlaceholder')}
                maxLength={100}
                {...form.register('jobTitle')}
              />
            </Field>
            <Field label={t('profile.phone')} error={fe(errors.phone?.message)}>
              <Input
                type="tel"
                autoComplete="tel"
                leadingIcon={<Phone />}
                maxLength={40}
                {...form.register('phone')}
              />
            </Field>
            <Field label={t('profile.location')} error={fe(errors.location?.message)}>
              <Input
                autoComplete="address-level2"
                leadingIcon={<MapPin />}
                placeholder={t('profile.locationPlaceholder')}
                maxLength={100}
                {...form.register('location')}
              />
            </Field>
            <div>
              <Field
                label={t('profile.timezone')}
                hint={t('profile.timezoneHint')}
                error={fe(errors.timezone?.message)}
              >
                <Input
                  list="profile-timezones"
                  leadingIcon={<Clock />}
                  placeholder={t('profile.timezonePlaceholder')}
                  maxLength={64}
                  {...form.register('timezone')}
                />
              </Field>
              <datalist id="profile-timezones">
                {TIMEZONES.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="mt-1"
                onClick={() =>
                  form.setValue('timezone', deviceTimezone(), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {t('profile.useDevice')}
              </Button>
            </div>
            <Field
              className="sm:col-span-2"
              label={t('profile.bio')}
              hint={t('profile.bioCount', { count: bioLength, max: 500 })}
              error={fe(errors.bio?.message)}
            >
              <Textarea
                rows={4}
                maxLength={500}
                placeholder={t('profile.bioPlaceholder')}
                {...form.register('bio')}
              />
            </Field>
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
