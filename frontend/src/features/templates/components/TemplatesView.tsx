import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarClock,
  CheckSquare,
  Clock,
  FilePlus2,
  ListTree,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import { transition } from '@/shared/motion';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pill,
  SegmentedControl,
  Skeleton,
  Switch,
  toast,
} from '@/shared/ui';
import type { RecurringTask, TaskTemplate } from '../api/templatesApi';
import {
  useRecurring,
  useRecurringMutations,
  useTemplateMutations,
  useTemplates,
} from '../hooks/useTemplates';
import { describeSchedule, weekdayNames } from '../model/describe';
import { RecurringDialog } from './RecurringDialog';
import { TemplateDialog } from './TemplateDialog';
import { UseTemplateDialog } from './UseTemplateDialog';

type Tab = 'templates' | 'recurring';

/** Task templates and the tasks that create themselves from them on a schedule. */
export function TemplatesView() {
  const { t } = useTranslation('templates');
  const { workspace } = useCurrentWorkspace();
  const [tab, setTab] = useState<Tab>('templates');
  const templates = useTemplates(workspace?.id);
  const recurring = useRecurring(workspace?.id);
  const editable = can(workspace, 'content.edit');
  const [editing, setEditing] = useState<{ template?: TaskTemplate } | null>(null);
  const [scheduling, setScheduling] = useState<{ recurring?: RecurringTask } | null>(null);

  if (!workspace || templates.isPending || recurring.isPending)
    return <Skeleton className="h-64" aria-busy />;
  const list = templates.data ?? [];
  const schedules = recurring.data ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t('tabs.label')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'templates', label: t('tabs.templates'), icon: <FilePlus2 /> },
            { value: 'recurring', label: t('tabs.recurring'), icon: <Repeat /> },
          ]}
        />
        {editable &&
          (tab === 'templates' ? (
            <Button onClick={() => setEditing({})}>
              <Plus />
              {t('new')}
            </Button>
          ) : (
            <Button onClick={() => setScheduling({})} disabled={list.length === 0}>
              <Plus />
              {t('recurring.new')}
            </Button>
          ))}
      </div>
      <p className="text-sm text-text-muted">
        {tab === 'templates' ? t('hint') : t('recurring.intro')}
      </p>

      {tab === 'templates' ? (
        <TemplateList
          workspaceId={workspace.id}
          items={list}
          editable={editable}
          onEdit={(template) => setEditing({ template })}
          onCreate={() => setEditing({})}
        />
      ) : (
        <RecurringList
          workspaceId={workspace.id}
          items={schedules}
          templates={list}
          editable={editable}
          onEdit={(r) => setScheduling({ recurring: r })}
          onCreate={() => setScheduling({})}
          hasTemplates={list.length > 0}
          goTemplates={() => setTab('templates')}
        />
      )}

      <TemplateDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        workspaceId={workspace.id}
        template={editing?.template}
      />
      <RecurringDialog
        open={!!scheduling}
        onOpenChange={(o) => !o && setScheduling(null)}
        workspaceId={workspace.id}
        templates={list}
        recurring={scheduling?.recurring}
      />
    </div>
  );
}

function TemplateList({
  workspaceId,
  items,
  editable,
  onEdit,
  onCreate,
}: {
  workspaceId: string;
  items: TaskTemplate[];
  editable: boolean;
  onEdit: (t: TaskTemplate) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation(['templates', 'common']);
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const { remove } = useTemplateMutations(workspaceId);
  const [using, setUsing] = useState<TaskTemplate | null>(null);
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);

  if (items.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<FilePlus2 />}
          title={t('empty.title')}
          description={t('empty.hint')}
          action={
            editable && (
              <Button onClick={onCreate}>
                <Plus />
                {t('new')}
              </Button>
            )
          }
        />
      </Card>
    );

  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((tpl, i) => (
          <motion.li
            key={tpl.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition.ui, delay: Math.min(i, 6) * 0.04 }}
          >
            <Card className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-medium text-text">{tpl.name}</h3>
                  <p className="truncate text-sm text-text-muted">{tpl.title}</p>
                </div>
                {editable && (
                  <div className="flex shrink-0 gap-0.5">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('edit', { name: tpl.name })}
                      onClick={() => onEdit(tpl)}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('delete', { name: tpl.name })}
                      onClick={() => setDeleting(tpl)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Pill size="sm">{t(`common:priority.${tpl.priority}`)}</Pill>
                {tpl.checklist.length > 0 && (
                  <Pill size="sm" icon={<CheckSquare aria-hidden />}>
                    {t('checklistCount', { count: tpl.checklist.length })}
                  </Pill>
                )}
                {tpl.subtasks.length > 0 && (
                  <Pill size="sm" icon={<ListTree aria-hidden />}>
                    {t('subtasksCount', { count: tpl.subtasks.length })}
                  </Pill>
                )}
                {tpl.dueInDays !== null && (
                  <Pill size="sm" icon={<Clock aria-hidden />}>
                    {t('dueIn', { count: tpl.dueInDays })}
                  </Pill>
                )}
              </div>
              {editable && (
                <div className="mt-auto pt-1">
                  <Button variant="secondary" size="sm" onClick={() => setUsing(tpl)}>
                    <Play />
                    {t('use.button')}
                  </Button>
                </div>
              )}
            </Card>
          </motion.li>
        ))}
      </ul>
      <UseTemplateDialog
        template={using}
        onOpenChange={(o) => !o && setUsing(null)}
        workspaceId={workspaceId}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle', { name: deleting?.name ?? '' })}
        description={t('deleteBody')}
        confirmLabel={t('deleteConfirm')}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('deleted'));
              setDeleting(null);
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </>
  );
}

function RecurringList({
  workspaceId,
  items,
  templates,
  editable,
  onEdit,
  onCreate,
  hasTemplates,
  goTemplates,
}: {
  workspaceId: string;
  items: RecurringTask[];
  templates: TaskTemplate[];
  editable: boolean;
  onEdit: (r: RecurringTask) => void;
  onCreate: () => void;
  hasTemplates: boolean;
  goTemplates: () => void;
}) {
  const { t } = useTranslation('templates');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const projects = useAllProjects(workspaceId).data?.items ?? [];
  const { update, remove } = useRecurringMutations(workspaceId);
  const [deleting, setDeleting] = useState<RecurringTask | null>(null);
  const names = weekdayNames(language);

  if (items.length === 0)
    return (
      <Card>
        <EmptyState
          icon={<CalendarClock />}
          title={t('recurring.empty.title')}
          description={hasTemplates ? t('recurring.empty.hint') : t('recurring.empty.needTemplate')}
          action={
            editable &&
            (hasTemplates ? (
              <Button onClick={onCreate}>
                <Plus />
                {t('recurring.new')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={goTemplates}>
                {t('tabs.templates')}
              </Button>
            ))
          }
        />
      </Card>
    );

  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((r) => {
          const tpl = templates.find((x) => x.id === r.templateId);
          const project = projects.find((p) => p.id === r.projectId);
          const d = describeSchedule(r, names);
          return (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-text">
                    {tpl?.name ?? t('recurring.unknownTemplate')}
                    {project && (
                      <span className="font-normal text-text-muted"> · {project.name}</span>
                    )}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {t(`recurring.describe.${d.key}`, d.values)}
                    <span className="text-text-muted"> · {r.timezone}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {r.active
                      ? t('recurring.next', { date: formatDate(r.nextRunAt, language) })
                      : t('recurring.paused')}
                    {r.lastRunAt &&
                      ` · ${t('recurring.last', { date: formatDate(r.lastRunAt, language) })}`}
                  </p>
                  {r.lastError && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-danger-ink">
                      <TriangleAlert className="size-3.5" aria-hidden />
                      {t('recurring.failed')}
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={r.active}
                      aria-label={t('recurring.toggle', { name: tpl?.name ?? '' })}
                      onCheckedChange={(active) =>
                        update.mutate(
                          {
                            id: r.id,
                            body: {
                              templateId: r.templateId,
                              projectId: r.projectId,
                              freq: r.freq,
                              weekdays: r.weekdays,
                              monthDay: r.monthDay ?? undefined,
                              hour: r.hour,
                              timezone: r.timezone,
                              active,
                            },
                          },
                          { onError: (e) => toast.error(errorText(e)) },
                        )
                      }
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('recurring.edit')}
                      onClick={() => onEdit(r)}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      label={t('recurring.delete')}
                      onClick={() => setDeleting(r)}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('recurring.deleteTitle')}
        description={t('recurring.deleteBody')}
        confirmLabel={t('deleteConfirm')}
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(t('recurring.deleted'));
              setDeleting(null);
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </>
  );
}
