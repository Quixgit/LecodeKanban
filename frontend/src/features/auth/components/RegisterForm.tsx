import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { isApiError } from '@/shared/api';
import { useLanguage } from '@/shared/i18n';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { Button, Field, FormAlert, Input, PasswordInput } from '@/shared/ui';
import { useRegister } from '../hooks/useSession';
import { registerSchema, type RegisterValues } from '../model/schemas';
import { applyServerFieldErrors } from '../model/serverErrors';
import { AuthHeading } from './AuthHeading';
import { OAuthButtons, OrDivider } from './OAuthButtons';
import { StrengthMeter } from './StrengthMeter';
import { useNextPath } from './useNextPath';

const FIELDS = ['name', 'email', 'password'] as const;

export function RegisterForm() {
  const { t } = useTranslation('auth');
  const fe = useFieldError();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const next = useNextPath();
  const { language } = useLanguage();
  const signUp = useRegister();
  const { register, handleSubmit, formState, setError, watch } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit((values) =>
    signUp.mutate(
      { ...values, locale: language },
      {
        onSuccess: () => navigate(next, { replace: true }),
        onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
      },
    ),
  );

  const fieldErrorsShown = isApiError(signUp.error) && signUp.error.fields.length > 0;

  return (
    <>
      <AuthHeading title={t('register.title')} subtitle={t('register.subtitle')} />
      <OAuthButtons next={next} />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{signUp.error && !fieldErrorsShown ? errorText(signUp.error) : null}</FormAlert>
        <Field label={t('fields.name')} error={fe(formState.errors.name?.message)}>
          <Input
            autoComplete="name"
            autoFocus
            leadingIcon={<UserRound />}
            placeholder={t('fields.namePlaceholder')}
            {...register('name')}
          />
        </Field>
        <Field label={t('fields.email')} error={fe(formState.errors.email?.message)}>
          <Input
            type="email"
            autoComplete="email"
            leadingIcon={<Mail />}
            placeholder={t('fields.emailPlaceholder')}
            {...register('email')}
          />
        </Field>
        <Field label={t('fields.password')} error={fe(formState.errors.password?.message)}>
          <PasswordInput
            autoComplete="new-password"
            placeholder={t('fields.passwordPlaceholder')}
            showLabel={t('password.show')}
            hideLabel={t('password.hide')}
            {...register('password')}
          />
        </Field>
        <StrengthMeter password={watch('password') ?? ''} />
        <Button type="submit" size="lg" block loading={signUp.isPending} className="mt-1">
          {t('register.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        {t('register.haveAccount')}{' '}
        <Link
          to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-primary-ink hover:underline"
        >
          {t('register.signIn')}
        </Link>
      </p>
    </>
  );
}
