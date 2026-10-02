import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneePicker, PRIORITIES, STATUSES, type Card } from '@/features/cards';
import type { Member } from '@/shared/api';
import { useLanguage } from '@/shared/i18n';
import { isPast } from '@/shared/lib/dates';
import { formatDate } from '@/shared/lib/format';
import {
  AvatarGroup,
  DateInput,
  PriorityPill,
  ProgressBar,
  Select,
  TaskStatusPill,
} from '@/shared/ui';
import { useProjectColumns } from '../hooks/useDrawerData';
import type { useCardEditor } from '../hooks/useCardEditor';
import { LabelPicker } from './LabelPicker';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Side panel of the drawer: workflow, people, dates, labels and the derived progress. */
export function CardFields({
  card,
  workspaceId,
  members,
  editable,
  editor,
}: {
  card: Card;
  workspaceId: string;
  members: Member[];
  editable: boolean;
  editor: ReturnType<typeof useCardEditor>;
}) {
  const { t } = useTranslation(['card', 'common']);
  const { language } = useLanguage();
  const columns = useProjectColumns(card.project.id);
  const overdue = card.status !== 'done' && isPast(card.dueDate);
  const progressSource =
    card.status === 'done' ? 'done' : card.checklist.total > 0 ? 'checklist' : 'stage';

  return (
    <dl className="flex flex-col gap-5">
      <Row label={t('fields.status')}>
        {editable && columns.data ? (
          <Select
            className="w-full justify-between"
            label={t('fields.status')}
            value={card.columnId}
            onValueChange={(columnId) => editor.move.mutate({ columnId })}
            options={columns.data.columns.map((c) => ({
              value: c.id,
              label:
                c.name === t(`common:status.${c.status}`)
                  ? c.name
                  : `${c.name} · ${t(`common:status.${c.status}`)}`,
            }))}
          />
        ) : editable ? (
          <Select
            className="w-full justify-between"
            label={t('fields.status')}
            value={card.status}
            onValueChange={(s) => editor.move.mutate({ status: s as Card['status'] })}
            options={STATUSES.map((s) => ({ value: s, label: t(`common:status.${s}`) }))}
          />
        ) : (
          <TaskStatusPill status={card.status} />
        )}
      </Row>
      <Row label={t('fields.priority')}>
        {editable ? (
          <Select
            className="w-full justify-between"
            label={t('fields.priority')}
            value={card.priority}
            onValueChange={(p) => editor.update.mutate({ priority: p as Card['priority'] })}
            options={PRIORITIES.map((p) => ({
              value: p,
              label: <PriorityPill priority={p} size="sm" />,
            }))}
          />
        ) : (
          <PriorityPill priority={card.priority} />
        )}
      </Row>
      <Row label={t('fields.assignees')}>
        {editable ? (
          <AssigneePicker
            members={members}
            label={t('fields.assignees')}
            value={card.assignees.map((a) => a.id)}
            onChange={(ids) => editor.update.mutate({ assigneeIds: ids })}
          />
        ) : card.assignees.length ? (
          <AvatarGroup
            size="sm"
            people={card.assignees.map((a) => ({ name: a.name, src: a.avatarUrl }))}
          />
        ) : (
          <span className="text-sm text-text-muted">{t('fields.nobody')}</span>
        )}
      </Row>
      <Row label={t('fields.due')}>
        {editable ? (
          <DateInput
            aria-label={t('fields.due')}
            value={card.dueDate ?? ''}
            invalid={overdue}
            onChange={(e) => editor.update.mutate({ dueDate: e.target.value || null })}
          />
        ) : (
          <span className={overdue ? 'text-sm font-medium text-danger-ink' : 'text-sm text-text'}>
            {card.dueDate ? formatDate(card.dueDate, language) : t('fields.noDue')}
          </span>
        )}
      </Row>
      <Row label={t('fields.labels')}>
        <LabelPicker
          workspaceId={workspaceId}
          value={card.labels}
          editable={editable}
          onChange={(ids) => editor.update.mutate({ labelIds: ids })}
        />
      </Row>
      <Row label={t('fields.progress')}>
        <div className="flex items-center gap-2">
          <ProgressBar value={card.progress} label={t('fields.progress')} />
          <span className="tabular w-10 text-right text-sm font-medium text-text">
            {card.progress}%
          </span>
        </div>
        <p className="mt-1 text-xs text-text-muted">{t(`progress.${progressSource}`)}</p>
      </Row>
      <Row label={t('fields.project')}>
        <span className="text-sm text-text">
          {card.project.key} · {card.project.name}
        </span>
      </Row>
      <div className="flex flex-col gap-1 border-t border-border-subtle pt-4 text-xs text-text-muted">
        <span>{t('fields.created', { date: formatDate(card.createdAt, language) })}</span>
        <span>{t('fields.updated', { date: formatDate(card.updatedAt, language) })}</span>
        {card.completedAt && (
          <span>{t('fields.completed', { date: formatDate(card.completedAt, language) })}</span>
        )}
      </div>
    </dl>
  );
}
