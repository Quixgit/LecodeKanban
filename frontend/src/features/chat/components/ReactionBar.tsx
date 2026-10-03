import { motion } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { IconButton, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/shared/ui';
import type { ChatReaction } from '../api/chatApi';
import { REACTION_ICONS, isIconKey, type ReactionKey } from '../model/reactions';
import { EmojiPicker, QuickReactions } from './EmojiPicker';

/** Reaction chips under a message; click toggles your own. The last chip opens the picker. */
export function ReactionBar({
  reactions,
  onToggle,
  readOnly,
}: {
  reactions: readonly ChatReaction[];
  onToggle: (key: ReactionKey, on: boolean) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation('chat');
  if (reactions.length === 0) return null;
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={t('reactions.label')}
    >
      {reactions.map((r) => {
        const Icon = isIconKey(r.key) ? REACTION_ICONS[r.key] : null;
        const name = Icon ? t(`reactions.names.${r.key}`) : r.key;
        return (
          <Tooltip key={r.key} content={t('reactions.tooltip', { name, count: r.count })}>
            <motion.button
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={transition.spring}
              whileTap={{ scale: 0.94 }}
              type="button"
              disabled={readOnly}
              aria-pressed={r.mine}
              aria-label={t('reactions.toggle', { name, count: r.count })}
              onClick={() => onToggle(r.key, !r.mine)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                r.mine
                  ? 'border-primary-border bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-muted',
              )}
            >
              {Icon ? (
                <Icon className="size-3.5 stroke-[1.8]" aria-hidden />
              ) : (
                <span className="text-sm leading-none" aria-hidden>
                  {r.key}
                </span>
              )}
              <span className="tabular-nums">{r.count}</span>
            </motion.button>
          </Tooltip>
        );
      })}
      {!readOnly && <ReactionPicker onPick={(key) => onToggle(key, true)} small />}
    </div>
  );
}

/** Opens the emoji picker for a reaction: a quick row, then every emoji with search. */
export function ReactionPicker({
  onPick,
  small,
}: {
  onPick: (key: ReactionKey) => void;
  small?: boolean;
}) {
  const { t } = useTranslation('chat');
  const [open, setOpen] = useState(false);
  const choose = (key: string) => {
    setOpen(false);
    onPick(key);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={t('reactions.add')}>
        <PopoverTrigger asChild>
          {small ? (
            <button
              type="button"
              aria-label={t('reactions.add')}
              className="grid h-7 w-8 place-items-center rounded-full border border-dashed border-border text-text-muted outline-none transition-colors duration-micro hover:border-border-strong hover:bg-surface-muted hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <SmilePlus className="size-3.5 stroke-[1.7]" aria-hidden />
            </button>
          ) : (
            <IconButton label={t('reactions.add')} variant="ghost" size="sm">
              <SmilePlus />
            </IconButton>
          )}
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="start" className="w-auto overflow-hidden p-0">
        <div className="border-b border-border-subtle p-1.5">
          <QuickReactions onPick={choose} />
        </div>
        <EmojiPicker onPick={choose} />
      </PopoverContent>
    </Popover>
  );
}
