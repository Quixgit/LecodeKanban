import type { TFunction } from 'i18next';
import type { ActivityEntry } from '../api/drawerApi';

export interface Lookups {
  people: Record<string, string>;
  labels: Record<string, string>;
  formatDate: (iso: string) => string;
}

type Change = { field: string; from?: unknown; to?: unknown };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function names(ids: string[], index: Record<string, string>, t: TFunction) {
  return ids.map((id) => index[id] ?? t('card:activity.unknown')).join(', ');
}

/** Human sentences (one per change) for an activity entry, in the current language. */
export function describeEntry(e: ActivityEntry, t: TFunction, l: Lookups): string[] {
  const d = e.data as Record<string, unknown>;
  const status = (s: unknown) => t(`common:status.${str(s)}`);
  switch (e.kind) {
    case 'card.created':
      return [t('card:activity.created')];
    case 'card.deleted':
      return [t('card:activity.deleted')];
    case 'card.moved':
      return [
        t('card:activity.moved', { from: status(d.from), to: status(d.to), column: str(d.column) }),
      ];
    case 'card.updated':
      return (Array.isArray(d.changes) ? (d.changes as Change[]) : []).flatMap((c) =>
        describeChange(c, t, l),
      );
    case 'comment.created':
      return [t('card:activity.commented')];
    case 'comment.deleted':
      return [t('card:activity.commentDeleted')];
    case 'attachment.added':
      return [t('card:activity.attached', { name: str(d.name) })];
    case 'attachment.removed':
      return [t('card:activity.detached', { name: str(d.name) })];
    default:
      if (e.kind.startsWith('checklist.')) {
        return [
          t(`card:activity.checklist.${e.kind.slice('checklist.'.length)}`, { text: str(d.text) }),
        ];
      }
      return [];
  }
}

function describeChange(c: Change, t: TFunction, l: Lookups): string[] {
  switch (c.field) {
    case 'title':
      return [t('card:activity.renamed', { to: str(c.to) })];
    case 'description':
      return [t('card:activity.description')];
    case 'priority':
      return [
        t('card:activity.priority', {
          from: t(`common:priority.${str(c.from)}`),
          to: t(`common:priority.${str(c.to)}`),
        }),
      ];
    case 'dueDate':
      return [
        c.to
          ? t('card:activity.due', { to: l.formatDate(str(c.to)) })
          : t('card:activity.dueCleared'),
      ];
    case 'assignees': {
      const out: string[] = [];
      if (list(c.to).length)
        out.push(t('card:activity.assigned', { names: names(list(c.to), l.people, t) }));
      if (list(c.from).length)
        out.push(t('card:activity.unassigned', { names: names(list(c.from), l.people, t) }));
      return out;
    }
    case 'labels': {
      const out: string[] = [];
      if (list(c.to).length)
        out.push(t('card:activity.labelled', { names: names(list(c.to), l.labels, t) }));
      if (list(c.from).length)
        out.push(t('card:activity.unlabelled', { names: names(list(c.from), l.labels, t) }));
      return out;
    }
    default:
      return [];
  }
}
