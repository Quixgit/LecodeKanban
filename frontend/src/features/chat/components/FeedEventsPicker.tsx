import {
  ArrowRight,
  ClipboardPlus,
  MessageSquareText,
  Pencil,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { FEED_KINDS, toggleKind, type FeedKind } from '../model/feed';

const ICONS: Record<FeedKind, LucideIcon> = {
  created: ClipboardPlus,
  assigned: UserPlus,
  moved: ArrowRight,
  updated: Pencil,
  deleted: Trash2,
  commented: MessageSquareText,
};

/** Which task events a feed takes: toggle chips, so "only new assignments" is one click. */
export function FeedEventsPicker({
  value,
  onChange,
}: {
  value: readonly FeedKind[];
  onChange: (next: FeedKind[]) => void;
}) {
  const { t } = useTranslation('chat');
  return (
    <fieldset className="mt-3">
      <legend className="mb-1.5 text-xs font-medium text-text-muted">
        {t('feed.eventsLabel')}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {FEED_KINDS.map((k) => {
          const on = value.includes(k);
          const Icon = ICONS[k];
          return (
            <button
              key={k}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onChange(toggleKind(value, k))}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                on
                  ? 'border-primary-border bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
              )}
            >
              <Icon className="size-3.5 stroke-[1.8]" aria-hidden />
              {t(`feed.events.${k}`)}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{t('feed.eventsHint')}</p>
    </fieldset>
  );
}
