import { Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCard } from '@/features/cards';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { IconButton, toast } from '@/shared/ui';
import { useElapsed, useRunningTimer, useTimeMutations } from '../hooks/useTime';
import { clock } from '../model/duration';

/** Header pill for the running timer: live clock, link to the card, stop. */
export function TimerIndicator() {
  const { t } = useTranslation('time');
  const errorText = useErrorText();
  const running = useRunningTimer().data ?? null;
  const card = useCard(running?.cardId).data;
  const elapsed = useElapsed(running?.startedAt, !!running);
  const { stop } = useTimeMutations();
  if (!running) return null;

  return (
    <div
      role="timer"
      aria-label={t('running')}
      className="hidden items-center gap-2 rounded-full bg-primary-subtle py-1 pl-3 pr-1 text-sm text-primary-ink md:flex"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      <Link
        to={`/tasks?card=${running.cardId}`}
        className="tabular max-w-[10rem] truncate font-medium hover:underline"
      >
        {card?.key ?? t('running')}
      </Link>
      <span className="tabular">{clock(elapsed)}</span>
      <IconButton
        size="sm"
        variant="ghost"
        label={t('stop')}
        onClick={() => stop.mutate(running.id, { onError: (e) => toast.error(errorText(e)) })}
      >
        <Square />
      </IconButton>
    </div>
  );
}
