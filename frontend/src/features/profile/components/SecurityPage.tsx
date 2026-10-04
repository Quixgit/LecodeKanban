import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Laptop, LogOut, Smartphone, Tablet } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StrengthMeter, useSession } from '@/features/auth';
import { isApiError } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import {
  Button,
  SettingsCard,
  EmptyState,
  Field,
  FormAlert,
  Pill,
  PasswordInput,
  Skeleton,
  toast,
} from '@/shared/ui';
import type { Device } from '../api/profileApi';
import { useChangePassword, useDeviceMutations, useDevices } from '../hooks/useProfile';
import { describeDevice, type DeviceKind } from '../model/device';
import { changePasswordSchema, type ChangePasswordValues } from '../model/schemas';

const ICONS = { desktop: Laptop, phone: Smartphone, tablet: Tablet } satisfies Record<
  DeviceKind,
  unknown
>;

function ChangePassword() {
  const { t } = useTranslation('profile');
  const { t: ta } = useTranslation('auth');
  const fe = useFieldError();
  const errorText = useErrorText();
  const { user } = useSession();
  const change = useChangePassword();
  const hasPassword = !!user?.hasPassword;
  const schema = useMemo(() => changePasswordSchema(hasPassword), [hasPassword]);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { current: '', password: '', confirm: '' },
    mode: 'onTouched',
  });
  const fieldErrors = isApiError(change.error) && change.error.fields.length > 0;

  const submit = form.handleSubmit((v) =>
    change.mutate(
      { currentPassword: hasPassword ? v.current : undefined, newPassword: v.password },
      {
        onSuccess: () => {
          form.reset();
          toast.success(t(hasPassword ? 'password.changed' : 'password.created'));
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'auth.current_password_incorrect') {
            form.setError('current', { message: errorText(e) });
          }
        },
      },
    ),
  );

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard
        title={t(hasPassword ? 'password.title' : 'password.titleSet')}
        description={t(hasPassword ? 'password.description' : 'password.descriptionSet')}
        footer={
          <Button type="submit" loading={change.isPending}>
            <KeyRound />
            {t(hasPassword ? 'password.submit' : 'password.submitSet')}
          </Button>
        }
      >
        <div className="flex max-w-md flex-col gap-4">
          <FormAlert>
            {change.error && !fieldErrors && !form.formState.errors.current
              ? errorText(change.error)
              : null}
          </FormAlert>
          {hasPassword && (
            <Field
              label={t('password.current')}
              error={
                form.formState.errors.current?.message &&
                (fe(form.formState.errors.current.message) ?? form.formState.errors.current.message)
              }
            >
              <PasswordInput
                autoComplete="current-password"
                showLabel={ta('password.show')}
                hideLabel={ta('password.hide')}
                {...form.register('current')}
              />
            </Field>
          )}
          <div>
            <Field
              label={t('password.new')}
              hint={t('password.rules')}
              error={fe(form.formState.errors.password?.message)}
            >
              <PasswordInput
                autoComplete="new-password"
                showLabel={ta('password.show')}
                hideLabel={ta('password.hide')}
                {...form.register('password')}
              />
            </Field>
            <StrengthMeter password={form.watch('password') ?? ''} />
          </div>
          <Field label={t('password.confirm')} error={fe(form.formState.errors.confirm?.message)}>
            <PasswordInput
              autoComplete="new-password"
              showLabel={ta('password.show')}
              hideLabel={ta('password.hide')}
              {...form.register('confirm')}
            />
          </Field>
          {hasPassword && <p className="text-xs text-text-muted">{t('password.signsOut')}</p>}
        </div>
      </SettingsCard>
    </form>
  );
}

function DeviceRow({ d }: { d: Device }) {
  const { t } = useTranslation('profile');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { signOut } = useDeviceMutations();
  const info = describeDevice(d.userAgent);
  const Icon = ICONS[info.kind];
  const name =
    info.browser && info.os
      ? t('devices.browserOn', { browser: info.browser, os: info.os })
      : info.browser || info.os || t('devices.unknown');
  return (
    <li className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-text-secondary">
        <Icon className="size-5 stroke-[1.6]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
          {name}
          {d.current && (
            <Pill tone="teal" size="sm">
              {t('devices.current')}
            </Pill>
          )}
        </p>
        <p className="text-xs text-text-muted">
          {d.ip && `${d.ip} · `}
          {t('devices.active', { when: formatRelative(d.lastSeenAt, language) })}
        </p>
      </div>
      {!d.current && (
        <Button
          size="sm"
          variant="ghost"
          loading={signOut.isPending && signOut.variables === d.id}
          aria-label={t('devices.signOutNamed', { name })}
          onClick={() =>
            signOut.mutate(d.id, {
              onSuccess: () => toast.success(t('devices.signedOut')),
              onError: (e) => toast.error(errorText(e)),
            })
          }
        >
          <LogOut />
          {t('devices.signOut')}
        </Button>
      )}
    </li>
  );
}

function Devices() {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const devices = useDevices();
  const { signOutOthers } = useDeviceMutations();
  const items = devices.data?.items ?? [];
  const others = items.filter((d) => !d.current).length;
  return (
    <SettingsCard
      title={t('devices.title')}
      description={t('devices.description')}
      footer={
        others > 0 ? (
          <Button
            variant="secondary"
            loading={signOutOthers.isPending}
            onClick={() =>
              signOutOthers.mutate(undefined, {
                onSuccess: () => toast.success(t('devices.othersSignedOut')),
                onError: (e) => toast.error(errorText(e)),
              })
            }
          >
            <LogOut />
            {t('devices.signOutOthers')}
          </Button>
        ) : undefined
      }
    >
      {devices.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : devices.isError ? (
        <EmptyState title={t('devices.loadFailed')} description={errorText(devices.error)} />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.map((d) => (
            <DeviceRow key={d.id} d={d} />
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

/** Password and the places the account is signed in. */
export function SecurityPage() {
  return (
    <div className="flex flex-col gap-6">
      <ChangePassword />
      <Devices />
    </div>
  );
}
