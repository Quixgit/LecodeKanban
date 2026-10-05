import { ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Field, FormAlert, Input } from '@/shared/ui';
import { useLoginTwoFactor } from '../hooks/useSession';
import { AuthHeading } from './AuthHeading';

/** The second step of signing in: the code from the authenticator app, or a recovery code. */
export function TwoFactorStep({
  token,
  onDone,
  onBack,
}: {
  token: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('auth');
  const errorText = useErrorText();
  const verify = useLoginTwoFactor();
  const [code, setCode] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate({ token, code: code.trim() }, { onSuccess: onDone });
  };
  return (
    <>
      <AuthHeading title={t('twoFactor.title')} subtitle={t('twoFactor.subtitle')} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormAlert>{verify.error ? errorText(verify.error) : null}</FormAlert>
        <Field label={t('twoFactor.code')} hint={t('twoFactor.hint')}>
          <Input
            autoFocus
            inputMode="text"
            autoComplete="one-time-code"
            leadingIcon={<ShieldCheck />}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123 456"
          />
        </Field>
        <Button type="submit" size="lg" block loading={verify.isPending} disabled={!code.trim()}>
          {t('twoFactor.submit')}
        </Button>
        <Button type="button" variant="ghost" block onClick={onBack}>
          {t('twoFactor.back')}
        </Button>
      </form>
    </>
  );
}
