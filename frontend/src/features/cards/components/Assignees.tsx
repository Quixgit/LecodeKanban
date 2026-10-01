import { useTranslation } from 'react-i18next';
import { Avatar, AvatarGroup, Tooltip } from '@/shared/ui';
import type { Card } from '../api/cardsApi';

/** Assignee cell: avatar + name for one person, stacked avatars for several. */
export function Assignees({ people }: { people: Card['assignees'] }) {
  const { t } = useTranslation('tasks');
  if (people.length === 0) return <span className="text-text-faint">{t('unassigned')}</span>;
  if (people.length === 1) {
    const p = people[0]!;
    return (
      <span className="flex min-w-0 items-center gap-2.5 font-medium text-text">
        <Avatar name={p.name} src={p.avatarUrl} size="sm" />
        <span className="truncate">{p.name}</span>
      </span>
    );
  }
  return (
    <Tooltip content={people.map((p) => p.name).join(', ')}>
      <span className="flex items-center gap-2" tabIndex={0}>
        <AvatarGroup
          people={people.map((p) => ({ name: p.name, src: p.avatarUrl }))}
          size="sm"
          max={3}
        />
      </span>
    </Tooltip>
  );
}
