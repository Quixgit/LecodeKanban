import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useFieldError } from '@/shared/hooks/useFieldError';
import { Button, EmptyState, Field, FormAlert, Input } from '@/shared/ui';
import { authApi } from '../api/authApi';
import { forgotSchema, type ForgotValues } from '../model/schemas';
import { AuthHeading } from './AuthHeading';

export function ForgotPasswordForm() {
  const { t } = useTranslation('auth');
  const fe = useFieldError();
  const errorText = useErrorText();
  const forgot = useMutation({ mutationFn: (v: ForgotValues) => authApi.forgot(v.email) });
  const [params] = useSearchParams();
  const { register, handleSubmit, formState, getValues } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: params.get('email') ?? '' },
  });

  const back = (
    <Button asChild variant="ghost">
      <Link to="/login">
        <ArrowLeft />
        {t('forgot.back')}
      </Link>
    </Button>
  );

  if (forgot.isSuccess) {
    return (
      <EmptyState
        className="px-0"
        icon={<MailCheck />}
        title={t('forgot.sentTitle')}
        description={t('forgot.sentBody', { email: getValues('email') })}
        action={back}
      />
    );
  }

  return (
    <>
      <AuthHeading title={t('forgot.title')} subtitle={t('forgot.subtitle')} />
      <form
        onSubmit={handleSubmit((v) => forgot.mutate(v))}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormAlert>{forgot.error ? errorText(forgot.error) : null}</FormAlert>
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
        <Button type="submit" size="lg" block loading={forgot.isPending}>
          {t('forgot.submit')}
        </Button>
      </form>
      <div className="mt-5 flex justify-center">{back}</div>
    </>
  );
}
