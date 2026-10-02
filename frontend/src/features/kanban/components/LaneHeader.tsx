import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Avatar, Pill, PriorityPill, toneClasses, type Tone } from '@/shared/ui';
import { UNASSIGNED, type LaneDef } from '../model/board';

interface Props {
  lane: LaneDef;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

/** Row title of a swimlane: collapse chevron, person / project / priority, count and a divider. */
export function LaneHeader({ lane, count, collapsed, onToggle }: Props) {
  const { t } = useTranslation('kanban');
  return (
    <h2 className="flex items-center gap-3 px-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={t(collapsed ? 'lane.expand' : 'lane.collapse', { name: lane.title })}
        className="-ml-1 flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <motion.span
          aria-hidden
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={transition.micro}
          className="flex text-text-muted"
        >
          <ChevronDown className="size-4" />
        </motion.span>
        {lane.kind === 'assignee' && (
          <Avatar
            size="xs"
            name={lane.key === UNASSIGNED ? '?' : lane.title}
            src={lane.avatarUrl}
          />
        )}
        {lane.kind === 'project' && (
          <span
            aria-hidden
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              toneClasses[(lane.tone as Tone) ?? 'teal'].fill,
            )}
          />
        )}
        {lane.kind === 'priority' && lane.priority ? (
          <PriorityPill priority={lane.priority} size="sm" />
        ) : (
          <span className="truncate text-base font-semibold text-text">{lane.title}</span>
        )}
      </button>
      <Pill size="sm" className="shrink-0 bg-surface-sunken font-normal text-text-secondary">
        <span className="tabular">{t('lane.count', { count })}</span>
      </Pill>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h2>
  );
}
