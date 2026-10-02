import { useTranslation } from 'react-i18next';
import { Avatar, PriorityPill } from '@/shared/ui';
import { UNASSIGNED, type LaneDef } from '../model/board';

/** Row title of a swimlane: person, project or priority, with its card count. */
export function LaneHeader({ lane, count }: { lane: LaneDef; count: number }) {
  const { t } = useTranslation('kanban');
  return (
    <h2 className="sticky left-0 flex w-fit items-center gap-2 text-sm font-medium text-text-secondary">
      {lane.kind === 'assignee' && (
        <Avatar size="xs" name={lane.key === UNASSIGNED ? '?' : lane.title} src={lane.avatarUrl} />
      )}
      {lane.kind === 'priority' && lane.priority ? (
        <PriorityPill priority={lane.priority} size="sm" />
      ) : (
        <span className="text-text">{lane.title}</span>
      )}
      <span className="tabular text-text-muted">{t('lane.count', { count })}</span>
    </h2>
  );
}
