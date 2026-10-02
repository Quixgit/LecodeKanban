import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIORITIES, type Label } from '@/features/cards';
import type { Member } from '@/shared/api';
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
  FilterSelect,
  Input,
} from '@/shared/ui';
import type { TaskFilters } from '../model/filters';

interface Props {
  filters: TaskFilters;
  update: (p: Record<string, string | undefined>) => void;
  clear: () => void;
  activeCount: number;
  projects: { id: string; name: string; key: string }[];
  members: Member[];
  labels?: Label[];
  currentUserId: string;
  canCreate: boolean;
  onCreate: () => void;
  /** Rendered at the right, before "Add task" (view switcher, board controls). */
  extra?: ReactNode;
}

/** DOM id of the search box ("/" shortcut focuses it). */
export const TASK_SEARCH_ID = 'tasks-search';

export function TasksToolbar({
  filters,
  update,
  clear,
  activeCount,
  projects,
  members,
  labels = [],
  currentUserId,
  canCreate,
  onCreate,
  extra,
}: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  const [q, setQ] = useState(filters.q);
  /** Last value we wrote to the URL, to tell our own debounced update from an outside change. */
  const pushed = useRef(filters.q);
  // "Clear" or a saved view changes the filters from outside: reflect it in the search box.
  useEffect(() => {
    if (filters.q !== pushed.current) {
      pushed.current = filters.q;
      setQ(filters.q);
    }
  }, [filters.q]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (q === filters.q) return;
      pushed.current = q;
      update({ q });
    }, 250);
    return () => window.clearTimeout(id);
  }, [q, filters.q, update]);
  const any = t('filters.any');

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        id={TASK_SEARCH_ID}
        wrapperClassName="w-full sm:w-80"
        leadingIcon={<Search />}
        placeholder={t('search')}
        aria-label={t('search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="secondary" aria-label={t('filters.title')}>
            <SlidersHorizontal />
            {t('filter')}
            {activeCount > 0 && (
              <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary-soft text-2xs font-semibold text-primary-ink">
                {activeCount}
              </span>
            )}
          </Button>
        </DropdownTrigger>
        <DropdownContent align="start" className="w-72 p-3">
          <DropdownLabel className="px-0">{t('filters.title')}</DropdownLabel>
          <div className="mt-1 flex flex-col gap-2.5" onKeyDown={(e) => e.stopPropagation()}>
            <FilterSelect
              className="w-full justify-between"
              label={t('filters.project')}
              placeholder={t('filters.project')}
              anyLabel={any}
              value={filters.projectId}
              onChange={(v) => update({ projectId: v })}
              options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
            />
            <FilterSelect
              className="w-full justify-between"
              label={t('filters.assignee')}
              placeholder={t('filters.assignee')}
              anyLabel={any}
              value={filters.assigneeId}
              onChange={(v) => update({ assigneeId: v })}
              options={[
                { value: currentUserId, label: t('filters.me') },
                ...members
                  .filter((m) => m.user.id !== currentUserId)
                  .map((m) => ({ value: m.user.id, label: m.user.name })),
              ]}
            />
            <FilterSelect
              className="w-full justify-between"
              label={t('filters.priority')}
              placeholder={t('filters.priority')}
              anyLabel={any}
              value={filters.priority}
              onChange={(v) => update({ priority: v })}
              options={PRIORITIES.map((p) => ({ value: p, label: t(`common:priority.${p}`) }))}
            />
            {labels.length > 0 && (
              <FilterSelect
                className="w-full justify-between"
                label={t('filters.label')}
                placeholder={t('filters.label')}
                anyLabel={any}
                value={filters.labelId}
                onChange={(v) => update({ labelId: v })}
                options={labels.map((l) => ({ value: l.id, label: l.name }))}
              />
            )}
            <FilterSelect
              className="w-full justify-between"
              label={t('filters.due')}
              placeholder={t('filters.due')}
              anyLabel={any}
              value={filters.due}
              onChange={(v) => update({ due: v })}
              options={(['overdue', 'today', 'week', 'month', 'none'] as const).map((d) => ({
                value: d,
                label: t(`filters.dueOptions.${d}`),
              }))}
            />
          </div>
          {activeCount > 0 && (
            <>
              <DropdownSeparator />
              <Button variant="ghost" size="sm" block onClick={clear}>
                <X />
                {t('filters.clear')}
              </Button>
            </>
          )}
        </DropdownContent>
      </Dropdown>
      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        {extra}
        {canCreate && (
          <Button onClick={onCreate}>
            <Plus />
            {t('add')}
          </Button>
        )}
      </div>
    </div>
  );
}
