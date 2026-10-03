import { motion } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  Tooltip,
} from '@/shared/ui';
import type { ChatReaction } from '../api/chatApi';
import { REACTION_ICONS, REACTION_KEYS, isReactionKey, type ReactionKey } from '../model/reactions';

/** Reaction chips under a message; click toggles your own. */
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
  const shown = reactions.filter((r) => isReactionKey(r.key));
  if (shown.length === 0) return null;
  return (
    <div
      className="mt-1.5 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label={t('reactions.label')}
    >
      {shown.map((r) => {
        const key = r.key as ReactionKey;
        const Icon = REACTION_ICONS[key];
        const name = t(`reactions.names.${key}`);
        return (
          <Tooltip key={key} content={t('reactions.tooltip', { name, count: r.count })}>
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
              onClick={() => onToggle(key, !r.mine)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors duration-micro focus-visible:shadow-focus',
                r.mine
                  ? 'border-primary-border bg-primary-soft text-primary-ink'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-muted',
              )}
            >
              <Icon className="size-3.5 stroke-[1.8]" aria-hidden />
              <span className="tabular-nums">{r.count}</span>
            </motion.button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** Opens the reaction palette: eight outline icons. */
export function ReactionPicker({ onPick }: { onPick: (key: ReactionKey) => void }) {
  const { t } = useTranslation('chat');
  return (
    <Dropdown>
      <Tooltip content={t('reactions.add')}>
        <DropdownTrigger asChild>
          <IconButton label={t('reactions.add')} variant="ghost" size="sm">
            <SmilePlus />
          </IconButton>
        </DropdownTrigger>
      </Tooltip>
      <DropdownContent align="start" className="flex w-auto gap-0.5 p-1.5">
        {REACTION_KEYS.map((key) => {
          const Icon = REACTION_ICONS[key];
          return (
            <DropdownItem
              key={key}
              aria-label={t(`reactions.names.${key}`)}
              title={t(`reactions.names.${key}`)}
              onSelect={() => onPick(key)}
              className="size-9 justify-center px-0 [&_svg]:size-[18px]"
            >
              <Icon />
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
}
