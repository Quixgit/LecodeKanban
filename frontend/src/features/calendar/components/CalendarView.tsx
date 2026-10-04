import { FolderPlus } from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useLabels } from '@/features/cards';
import { useAllProjects } from '@/features/projects';
import { useWorkspaceSettings } from '@/features/settings';
import { TasksToolbar, baseQuery, useTaskFilters } from '@/features/tasks-list';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Card as Panel, EmptyState, Skeleton, toast } from '@/shared/ui';
import { useCalendarCards, useReschedule } from '../hooks/useCalendarData';
import { MODES, isKey, shift, todayKey, type CalendarMode } from '../model/dates';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';

interface Props {
  currentUserId: string;
  /** View switcher owned by the Tasks page (omitted on the standalone Calendar page). */
  viewSwitch?: ReactNode;
  /** Create a card, optionally pre-dated. */
  onCreate: (day?: string) => void;
}

/** Month / week / day calendar of cards by due date; drag a card to another day to reschedule. */
export function CalendarView({ currentUserId, viewSwitch, onCreate }: Props) {
  const { t } = useTranslation(['calendar', 'tasks']);
  const errorText = useErrorText();
  const [params, setParams] = useSearchParams();
  const { workspace } = useCurrentWorkspace();
  const weekStart = useWorkspaceSettings(workspace?.id).data?.weekStart === 0 ? 0 : 1;
  const ws = workspace?.id ?? '';
  const canEdit = can(workspace, 'content.edit');
  const { filters, update, clear, activeCount } = useTaskFilters();
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const labels = useLabels(workspace?.id);
  const board = useCalendarCards(workspace?.id, baseQuery(filters));
  const reschedule = useReschedule(ws);

  const today = todayKey();
  const rawMode = params.get('cal');
  const mode: CalendarMode = MODES.includes(rawMode as CalendarMode)
    ? (rawMode as CalendarMode)
    : 'month';
  const rawDate = params.get('on');
  const anchor = isKey(rawDate) ? rawDate : today;

  const go = useCallback(
    (patch: { cal?: CalendarMode; on?: string }) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.cal) next.set('cal', patch.cal);
          if (patch.on) next.set('on', patch.on);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const openCard = useCallback(
    (id: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('card', id);
        return next;
      }),
    [setParams],
  );

  const cards = useMemo(() => board.data?.items ?? [], [board.data]);
  const projectOptions = (projects.data?.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    key: p.key,
  }));

  const toolbar = (
    <Panel className="p-4">
      <TasksToolbar
        filters={filters}
        update={update}
        clear={clear}
        activeCount={activeCount}
        projects={projectOptions}
        members={members.data ?? []}
        labels={labels.data}
        currentUserId={currentUserId}
        canCreate={canEdit}
        onCreate={() => onCreate()}
        extra={viewSwitch}
      />
    </Panel>
  );

  if (!workspace || projects.isPending || board.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        {toolbar}
        <Skeleton className="h-[34rem] rounded-xl" />
      </div>
    );
  }
  if (projectOptions.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={<FolderPlus />}
          title={t('tasks:empty.noProjects')}
          action={
            <Button asChild>
              <Link to="/projects">{t('tasks:empty.createProject')}</Link>
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {toolbar}
      {board.data?.truncated && (
        <p
          role="status"
          className="rounded-lg bg-progress-soft px-4 py-2 text-sm text-progress-ink"
        >
          {t('truncated')}
        </p>
      )}
      <CalendarHeader
        anchor={anchor}
        mode={mode}
        onMode={(m) => go({ cal: m })}
        onPrev={() => go({ on: shift(anchor, mode, -1) })}
        onNext={() => go({ on: shift(anchor, mode, 1) })}
        onToday={() => go({ on: today })}
      />
      <CalendarGrid
        weekStart={weekStart}
        anchor={anchor}
        mode={mode}
        today={today}
        cards={cards}
        canEdit={canEdit}
        onOpen={openCard}
        onZoom={(day) => go({ cal: 'day', on: day })}
        onCreate={canEdit ? onCreate : undefined}
        onReschedule={(card, day) => reschedule(card, day, (e) => toast.error(errorText(e)))}
      />
    </div>
  );
}
