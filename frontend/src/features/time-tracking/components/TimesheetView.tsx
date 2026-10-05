import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Timer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Button, Card, EmptyState, FilterSelect, IconButton, Reveal, Skeleton } from '@/shared/ui';
import type { TimesheetEntry } from '../api/timeApi';
import { useRunningTimer, useTimesheet } from '../hooks/useTime';
import { compact } from '../model/duration';
import { addDays, buildGrid, dayKey, sameDay, startOfWeek, weekDays } from '../model/week';
import { CellEntries } from './CellEntries';
import { Duration } from './Duration';
import { LogTimeDialog } from './LogTimeDialog';

/** A working day, for the bar under each day's total. */
const DAY_GOAL = 8 * 3600;

interface Open {
  card: TimesheetEntry['card'];
  day: Date;
}

/** The week's time as a grid: tasks down the side, days across; every cell is a place to add or fix time. */
export function TimesheetView() {
  const { t } = useTranslation('time');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const { workspace } = useCurrentWorkspace();
  const manager = can(workspace, 'time.manage');
  const [start, setStart] = useState(() => startOfWeek(new Date()));
  const [userId, setUserId] = useState<string>();
  const [projectId, setProjectId] = useState<string>();
  const [cell, setCell] = useState<Open | null>(null);
  const [adding, setAdding] = useState(false);
  const running = useRunningTimer().data ?? null;
  const projects = useAllProjects(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);

  const days = useMemo(() => weekDays(start), [start]);
  const query = useMemo(
    () => ({ from: start.toISOString(), to: addDays(start, 7).toISOString(), userId, projectId }),
    [start, userId, projectId],
  );
  const sheet = useTimesheet(workspace?.id, query, true, !!running && !userId);
  const grid = useMemo(() => buildGrid(sheet.data?.entries ?? [], days), [sheet.data, days]);
  const today = new Date();
  const readOnly = !!userId;
  const thisWeek = sameDay(start, startOfWeek(today));
  const viewed = members.data?.find((m) => m.user.id === userId)?.user.name;

  const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) =>
    new Intl.DateTimeFormat(language, opts).format(d);
  const range = `${fmt({ day: 'numeric', month: 'short' }, days[0]!)} – ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }, days[6]!)}`;
  const entriesOf = (cardId: string, day: Date) =>
    (sheet.data?.entries ?? []).filter(
      (e) => e.card.id === cardId && dayKey(new Date(e.entry.startedAt)) === dayKey(day),
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-xs">
          <IconButton
            variant="ghost"
            size="sm"
            label={t('sheet.prev')}
            onClick={() => setStart((s) => addDays(s, -7))}
          >
            <ChevronLeft />
          </IconButton>
          <Button
            variant="ghost"
            size="sm"
            disabled={thisWeek}
            onClick={() => setStart(startOfWeek(new Date()))}
          >
            {t('sheet.thisWeek')}
          </Button>
          <IconButton
            variant="ghost"
            size="sm"
            label={t('sheet.next')}
            onClick={() => setStart((s) => addDays(s, 7))}
          >
            <ChevronRight />
          </IconButton>
        </div>
        <h2 className="tabular text-lg font-semibold text-text" aria-live="polite">
          {range}
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {manager && (
            <FilterSelect
              label={t('sheet.person')}
              placeholder={t('sheet.person')}
              anyLabel={t('sheet.me')}
              value={userId}
              onChange={setUserId}
              options={(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.name }))}
            />
          )}
          <FilterSelect
            label={t('sheet.project')}
            placeholder={t('sheet.project')}
            anyLabel={t('sheet.allProjects')}
            value={projectId}
            onChange={setProjectId}
            options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          {!readOnly && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              {t('sheet.logTime')}
            </Button>
          )}
        </div>
      </div>
      {readOnly && viewed && (
        <p
          role="status"
          className="rounded-lg bg-primary-subtle px-3 py-2 text-sm text-primary-ink"
        >
          {t('sheet.readOnly', { name: viewed })}
        </p>
      )}

      <Reveal>
        <Card className="overflow-hidden">
          {sheet.isPending ? (
            <Skeleton className="h-72 rounded-none" aria-busy />
          ) : sheet.error ? (
            <EmptyState title={errorText(sheet.error)} />
          ) : grid.rows.length === 0 ? (
            <EmptyState
              icon={<Timer />}
              title={t('sheet.empty')}
              description={t('sheet.emptyHint')}
              action={
                !readOnly ? (
                  <Button onClick={() => setAdding(true)}>
                    <Plus />
                    {t('sheet.logTime')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 w-64 bg-surface px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
                    >
                      {t('sheet.task')}
                    </th>
                    {days.map((d, i) => {
                      const isToday = sameDay(d, today);
                      const pct = Math.min(100, (grid.dayTotals[i]! / DAY_GOAL) * 100);
                      return (
                        <th
                          key={dayKey(d)}
                          scope="col"
                          className={cn(
                            'px-2 py-3 text-center font-normal',
                            isToday && 'bg-primary-subtle/60',
                          )}
                        >
                          <span
                            className={cn(
                              'block text-xs font-medium uppercase tracking-wide',
                              isToday ? 'text-primary-ink' : 'text-text-muted',
                            )}
                          >
                            {fmt({ weekday: 'short' }, d)}
                          </span>
                          <span className="block text-base font-semibold text-text">
                            {d.getDate()}
                          </span>
                          <span
                            className="mx-auto mt-1.5 block h-1 w-10 overflow-hidden rounded-full bg-surface-sunken"
                            title={t('sheet.dayGoal', { h: 8 })}
                          >
                            <motion.span
                              className={cn(
                                'block h-full origin-left rounded-full',
                                pct >= 100 ? 'bg-done' : 'bg-primary',
                              )}
                              style={{ width: `${pct}%` }}
                              initial={reduce ? false : { scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ ...transition.large, duration: 0.6, delay: i * 0.04 }}
                            />
                          </span>
                        </th>
                      );
                    })}
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-text-muted"
                    >
                      {t('sheet.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((row, r) => (
                    <motion.tr
                      key={row.card.id}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...transition.ui, delay: Math.min(r, 8) * 0.03 }}
                      className="border-b border-border-subtle last:border-b-0 hover:bg-surface-muted/60"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal"
                      >
                        <Link to={`/tasks?card=${row.card.id}`} className="group block min-w-0">
                          <span className="block truncate text-sm font-medium text-text group-hover:text-primary">
                            {row.card.title}
                          </span>
                          <span className="tabular block truncate text-xs text-text-muted">
                            {row.card.key} · {row.card.project.name}
                          </span>
                        </Link>
                      </th>
                      {days.map((d, i) => {
                        const seconds = row.cells[i]!;
                        const label = seconds
                          ? t('sheet.cell', {
                              task: row.card.key,
                              day: fmt({ weekday: 'long', day: 'numeric', month: 'long' }, d),
                              time: compact(seconds),
                            })
                          : t('sheet.cellEmpty', {
                              task: row.card.key,
                              day: fmt({ weekday: 'long', day: 'numeric', month: 'long' }, d),
                            });
                        return (
                          <td
                            key={dayKey(d)}
                            className={cn(
                              'p-1 text-center',
                              sameDay(d, today) && 'bg-primary-subtle/40',
                            )}
                          >
                            <button
                              type="button"
                              disabled={readOnly}
                              aria-label={label}
                              onClick={() => setCell({ card: row.card, day: d })}
                              className={cn(
                                'tabular h-9 w-full min-w-12 rounded-lg text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30',
                                seconds ? 'font-medium text-text' : 'text-text-faint',
                                !readOnly && 'hover:bg-primary-soft',
                              )}
                            >
                              {seconds ? compact(seconds) : readOnly ? '' : '+'}
                            </button>
                          </td>
                        );
                      })}
                      <td className="tabular px-4 py-2.5 text-right font-semibold text-text">
                        {compact(row.total)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface-muted/50">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text"
                    >
                      {t('sheet.total')}
                    </th>
                    {grid.dayTotals.map((s, i) => (
                      <td
                        key={i}
                        className="tabular px-2 py-3 text-center text-sm font-semibold text-text"
                      >
                        {compact(s)}
                      </td>
                    ))}
                    <td className="tabular px-4 py-3 text-right text-base font-semibold text-text">
                      <Duration seconds={grid.total} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </Reveal>

      <LogTimeDialog
        open={adding}
        onOpenChange={setAdding}
        day={sameDay(start, startOfWeek(today)) ? today : start}
      />
      {cell && (
        <CellEntries
          open
          onOpenChange={(o) => !o && setCell(null)}
          title={t('sheet.entriesFor', {
            task: cell.card.key,
            day: fmt({ weekday: 'long', day: 'numeric', month: 'short' }, cell.day),
          })}
          card={cell.card}
          day={cell.day}
          entries={entriesOf(cell.card.id, cell.day)}
        />
      )}
    </div>
  );
}
