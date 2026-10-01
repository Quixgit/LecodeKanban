import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck, MailX } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, EmptyState, Skeleton } from '@/shared/ui';
import { authApi } from '../api/authApi';
import { sessionKey } from '../hooks/useSession';

export function VerifyEmailView() {
  const { t } = useTranslation('auth');
  const errorText = useErrorText();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useMutation({
    mutationFn: authApi.verify,
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects; the token is single-use, so submit exactly once.
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  const cont = (
    <Button asChild>
      <Link to="/">{t('verify.continue')}</Link>
    </Button>
  );

  if (!token)
    return (
      <EmptyState
        className="px-0"
        icon={<MailX />}
        title={t('verify.failedTitle')}
        description={t('verify.missingToken')}
        action={cont}
      />
    );
  if (verify.isSuccess)
    return (
      <EmptyState
        className="px-0"
        icon={<MailCheck />}
        title={t('verify.successTitle')}
        description={t('verify.successBody')}
        action={cont}
      />
    );
  if (verify.isError)
    return (
      <EmptyState
        className="px-0"
        icon={<MailX />}
        title={t('verify.failedTitle')}
        description={errorText(verify.error)}
        action={cont}
      />
    );

  return (
    <div className="flex flex-col items-center gap-4 py-14" aria-busy>
      <Skeleton className="size-14 rounded-2xl" />
      <p className="text-base text-text-secondary">{t('verify.verifying')}</p>
    </div>
  );
}
