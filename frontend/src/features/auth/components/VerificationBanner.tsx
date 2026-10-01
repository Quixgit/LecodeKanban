import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { transition } from '@/shared/motion';
import { Button, IconButton } from '@/shared/ui';
import { authApi } from '../api/authApi';
import { useSession } from '../hooks/useSession';

/** Slim banner reminding unverified users to confirm their email. */
export function VerificationBanner() {
  const { t } = useTranslation('auth');
  const errorText = useErrorText();
  const { user } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const resend = useMutation({ mutationFn: authApi.resendVerification });
  const show = !!user && !user.emailVerified && !dismissed;

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition.ui}
          className="overflow-hidden"
        >
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-progress/30 bg-progress-soft px-4 py-2.5 text-sm text-progress-ink"
          >
            <MailWarning className="size-[18px] shrink-0 stroke-[1.75]" aria-hidden />
            <span className="flex-1">
              {resend.isSuccess
                ? t('banner.sent')
                : resend.isError
                  ? errorText(resend.error)
                  : t('banner.unverified', { email: user.email })}
            </span>
            {!resend.isSuccess && (
              <Button
                size="sm"
                variant="secondary"
                loading={resend.isPending}
                onClick={() => resend.mutate()}
              >
                {t('banner.resend')}
              </Button>
            )}
            <IconButton
              label={t('banner.dismiss')}
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
            >
              <X />
            </IconButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
