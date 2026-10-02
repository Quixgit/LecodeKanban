import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui';
import { useRealtimeStore } from '../model/gate';

const dot = { live: 'bg-done', connecting: 'bg-progress-bar', offline: 'bg-danger' } as const;

/** Small status dot: are other people's changes arriving live? */
export function LiveIndicator({ className }: { className?: string }) {
  const { t } = useTranslation('kanban');
  const state = useRealtimeStore((s) => s.connection);
  return (
    <Tooltip content={t(`live.${state}Hint`)}>
      <span
        role="status"
        aria-label={t(`live.${state}`)}
        className={cn(
          'inline-flex h-control items-center gap-1.5 px-1 text-xs text-text-muted',
          className,
        )}
      >
        <span className="relative flex size-2">
          {state === 'live' && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-done opacity-50 motion-reduce:animate-none" />
          )}
          <span className={cn('relative inline-flex size-2 rounded-full', dot[state])} />
        </span>
        <span className="hidden xl:inline">{t(`live.${state}`)}</span>
      </span>
    </Tooltip>
  );
}
