import { LayoutGrid, List, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { Button, FilterSelect, Input, SegmentedControl } from '@/shared/ui';
import type { ProjectFilters, ProjectsView } from '../model/filters';

interface Props {
  filters: ProjectFilters;
  update: (patch: Record<string, string | undefined>) => void;
  clear: () => void;
  active: boolean;
  members: Member[];
  teams: string[];
  canCreate: boolean;
  onCreate: () => void;
}

export function ProjectsToolbar({
  filters,
  update,
  clear,
  active,
  members,
  teams,
  canCreate,
  onCreate,
}: Props) {
  const { t } = useTranslation(['projects', 'common']);
  const [q, setQ] = useState(filters.q);

  // Debounce search typing into the URL.
  useEffect(() => {
    const id = window.setTimeout(() => q !== filters.q && update({ q }), 250);
    return () => window.clearTimeout(id);
  }, [q, filters.q, update]);

  const any = t('filters.any');
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Input
        wrapperClassName="w-full sm:w-72"
        leadingIcon={<Search />}
        placeholder={t('search')}
        aria-label={t('search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <FilterSelect
        label={t('filters.status')}
        placeholder={t('filters.status')}
        anyLabel={any}
        value={filters.status}
        onChange={(v) => update({ status: v })}
        options={(['in_progress', 'completed', 'pending'] as const).map((s) => ({
          value: s,
          label: t(`common:projectStatus.${s}`),
        }))}
      />
      <FilterSelect
        label={t('filters.pic')}
        placeholder={t('filters.pic')}
        anyLabel={any}
        value={filters.picId}
        onChange={(v) => update({ picId: v })}
        options={members.map((m) => ({ value: m.user.id, label: m.user.name }))}
      />
      {teams.length > 0 && (
        <FilterSelect
          label={t('filters.team')}
          placeholder={t('filters.team')}
          anyLabel={any}
          value={filters.team}
          onChange={(v) => update({ team: v })}
          options={teams.map((team) => ({ value: team, label: team }))}
        />
      )}
      <FilterSelect
        label={t('filters.progress')}
        placeholder={t('filters.progress')}
        anyLabel={any}
        value={filters.progress}
        onChange={(v) => update({ progress: v })}
        options={(['not_started', 'early', 'midway', 'almost', 'done'] as const).map((p) => ({
          value: p,
          label: t(`filters.progressOptions.${p}`),
        }))}
      />
      <FilterSelect
        label={t('filters.deadline')}
        placeholder={t('filters.deadline')}
        anyLabel={any}
        value={filters.deadline}
        onChange={(v) => update({ deadline: v })}
        options={(['overdue', 'week', 'month', 'later', 'none'] as const).map((d) => ({
          value: d,
          label: t(`filters.deadlineOptions.${d}`),
        }))}
      />
      {active && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X />
          {t('filters.clear')}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2.5">
        <SegmentedControl<ProjectsView>
          label={t('views.label')}
          value={filters.view}
          onChange={(v) => update({ view: v === 'card' ? undefined : v })}
          options={[
            { value: 'list', label: t('views.list'), icon: <List /> },
            { value: 'card', label: t('views.card'), icon: <LayoutGrid /> },
          ]}
        />
        {canCreate && (
          <>
            <span aria-hidden className="hidden h-8 w-px bg-border sm:block" />
            <Button onClick={onCreate}>
              <Plus />
              {t('add')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
