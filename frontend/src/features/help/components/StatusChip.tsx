import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { SupportStatus } from '../api/supportApi';

const TONE: Record<SupportStatus, string> = {
  new: 'bg-review-soft text-review-ink',
  in_progress: 'bg-progress-soft text-progress-ink',
  resolved: 'bg-done-soft text-done-ink',
};

/** New / in progress / resolved. */
export function StatusChip({ status }: { status: SupportStatus }) {
  const { t } = useTranslation('help');
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', TONE[status])}>
      {t(`support.status.${status}`)}
    </span>
  );
}
