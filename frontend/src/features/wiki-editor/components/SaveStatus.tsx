import { Check, CloudOff, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { SaveState } from '../hooks/useAutosave';

const view = {
  saved: { icon: Check, tone: 'text-text-muted' },
  saving: { icon: Loader2, tone: 'text-text-muted' },
  offline: { icon: CloudOff, tone: 'text-progress-ink' },
  conflict: { icon: TriangleAlert, tone: 'text-danger-ink' },
  error: { icon: TriangleAlert, tone: 'text-danger-ink' },
} as const;

/** "Saving…" / "Saved" / "Offline" — announced politely, never stealing focus. */
export function SaveStatus({ state }: { state: SaveState }) {
  const { t } = useTranslation('wikiEditor');
  const { icon: Icon, tone } = view[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-sm', tone)}
    >
      <Icon
        className={cn('size-3.5 stroke-[1.75]', state === 'saving' && 'motion-safe:animate-spin')}
        aria-hidden
      />
      {t(`status.${state}`)}
    </span>
  );
}
