import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { Button, Field, FormAlert, Input, PasswordInput } from '@/shared/ui';
import { useLogin } from '../hooks/useSession';
import { loginSchema, type LoginValues } from '../model/schemas';
import { AuthHeading } from './AuthHeading';
import { OAuthButtons, OrDivider } from './OAuthButtons';
import { useNextPath } from './useNextPath';

export function LoginForm() {
  const { t } = useTranslation('auth');
  const fe = useFieldError();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const next = useNextPath();
  const [params] = useSearchParams();
  const login = useLogin();
  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  });

  const oauthError = params.get('error');
  const alert = login.error
    ? errorText(login.error)
    : oauthError
      ? errorText(new ApiError(400, oauthError, oauthError))
      : null;

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate(next, { replace: true }) }),
  );

  return (
    <>
      <AuthHeading title={t('login.title')} subtitle={t('login.subtitle')} />
      <OAuthButtons next={next} />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert>{alert}</FormAlert>
        <Field label={t('fields.email')} error={fe(formState.errors.email?.message)}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            leadingIcon={<Mail />}
            placeholder={t('fields.emailPlaceholder')}
            {...register('email')}
          />
        </Field>
        <Field label={t('fields.password')} error={fe(formState.errors.password?.message)}>
          <PasswordInput
            autoComplete="current-password"
            showLabel={t('password.show')}
            hideLabel={t('password.hide')}
            {...register('password')}
          />
        </Field>
        <div className="-mt-1 flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-ink hover:underline"
          >
            {t('login.forgot')}
          </Link>
        </div>
        <Button type="submit" size="lg" block loading={login.isPending}>
          {t('login.submit')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-text-secondary">
        {t('login.noAccount')}{' '}
        <Link
          to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="font-medium text-primary-ink hover:underline"
        >
          {t('login.createAccount')}
        </Link>
      </p>
    </>
  );
}
