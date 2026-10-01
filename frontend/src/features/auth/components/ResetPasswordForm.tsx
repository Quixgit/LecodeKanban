import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { Button, EmptyState, Field, FormAlert, PasswordInput } from '@/shared/ui';
import { authApi } from '../api/authApi';
import { sessionKey } from '../hooks/useSession';
import { resetSchema, type ResetValues } from '../model/schemas';
import { applyServerFieldErrors } from '../model/serverErrors';
import { AuthHeading } from './AuthHeading';
import { StrengthMeter } from './StrengthMeter';

export function ResetPasswordForm() {
  const { t } = useTranslation('auth');
  const fe = useFieldError();
  const errorText = useErrorText();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useMutation({
    mutationFn: (v: ResetValues) => authApi.reset(token, v.password),
    onSuccess: () => qc.setQueryData(sessionKey, null),
  });
  const { register, handleSubmit, formState, setError, watch } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onTouched',
  });

  const requestNew = (
    <Button asChild variant="secondary">
      <Link to="/forgot-password">{t('reset.requestNew')}</Link>
    </Button>
  );

  if (!token) {
    return (
      <EmptyState
        className="px-0"
        icon={<KeyRound />}
        title={t('reset.title')}
        description={t('reset.missingToken')}
        action={requestNew}
      />
    );
  }
  if (reset.isSuccess) {
    return (
      <EmptyState
        className="px-0"
        icon={<ShieldCheck />}
        title={t('reset.successTitle')}
        description={t('reset.successBody')}
        action={
          <Button asChild>
            <Link to="/login">{t('login.submit')}</Link>
          </Button>
        }
      />
    );
  }

  const onSubmit = handleSubmit((v) =>
    reset.mutate(v, { onError: (err) => applyServerFieldErrors(err, setError, ['password']) }),
  );

  return (
    <>
      <AuthHeading title={t('reset.title')} subtitle={t('reset.subtitle')} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>
          {reset.error && !formState.errors.password ? errorText(reset.error) : null}
        </FormAlert>
        <Field label={t('fields.newPassword')} error={fe(formState.errors.password?.message)}>
          <PasswordInput
            autoComplete="new-password"
            autoFocus
            showLabel={t('password.show')}
            hideLabel={t('password.hide')}
            {...register('password')}
          />
        </Field>
        <StrengthMeter password={watch('password') ?? ''} />
        <Field label={t('fields.confirmPassword')} error={fe(formState.errors.confirm?.message)}>
          <PasswordInput
            autoComplete="new-password"
            showLabel={t('password.show')}
            hideLabel={t('password.hide')}
            {...register('confirm')}
          />
        </Field>
        <Button type="submit" size="lg" block loading={reset.isPending}>
          {t('reset.submit')}
        </Button>
        {reset.error && <div className="flex justify-center">{requestNew}</div>}
      </form>
    </>
  );
}
