import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/shared/ui';

/** Shown instead of a workspace's pages when it requires two-step verification and the person has not turned it on. */
export function TwoFactorGate({ name }: { name: string }) {
  const { t } = useTranslation('team');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border-subtle bg-surface px-8 py-12 text-center shadow-card">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary-subtle text-primary-ink">
        <ShieldCheck className="size-7 stroke-[1.6]" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-text">{t('twoFactorGate.title', { name })}</h2>
      <p className="text-sm text-text-secondary">{t('twoFactorGate.body')}</p>
      <Link to="/profile/security" className={buttonVariants({ size: 'lg' })}>
        {t('twoFactorGate.action')}
      </Link>
    </div>
  );
}
