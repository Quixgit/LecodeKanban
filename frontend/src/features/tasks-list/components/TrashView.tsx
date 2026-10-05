import { ArchiveRestore, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useRestoreCard, useTrash } from '@/features/cards';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { Button, Card, EmptyState, Pill, Skeleton, StatusTag, toast } from '@/shared/ui';

/** Deleted tasks: look, and bring them back. */
export function TrashView() {
  const { t } = useTranslation('tasks');
  const errorText = useErrorText();
  const { language } = useLanguage();
  const { workspace } = useCurrentWorkspace();
  const trash = useTrash(workspace?.id);
  const restore = useRestoreCard(workspace?.id ?? '');
  const allowed = can(workspace, 'tasks.delete');

  if (!workspace || trash.isPending) return <Skeleton className="h-64" aria-busy />;
  if (!allowed) return <EmptyState icon={<Trash2 />} title={t('trash.noAccess')} />;
  const items = trash.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{t('trash.hint')}</p>
        <Link to="/tasks" className="text-sm font-medium text-primary-ink hover:underline">
          {t('trash.back')}
        </Link>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Trash2 />}
            title={t('trash.empty')}
            description={t('trash.emptyHint')}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('trash.title')}>
          {items.map(({ card, deletedAt }) => (
            <li key={card.id}>
              <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="tabular w-20 shrink-0 font-mono text-xs text-text-muted">
                  {card.key}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{card.title}</p>
                  <p className="text-xs text-text-muted">
                    {t('trash.deleted', { when: formatRelative(deletedAt, language) })}
                    {card.subtasks.total > 0 &&
                      ` · ${t('trash.subtasks', { count: card.subtasks.total })}`}
                  </p>
                </div>
                <StatusTag status={card.status} className="h-7 text-xs" />
                {card.parent && (
                  <Pill size="sm">{t('trash.subtaskOf', { key: card.parent.key })}</Pill>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  loading={restore.isPending && restore.variables === card.id}
                  onClick={() =>
                    restore.mutate(card.id, {
                      onSuccess: () => toast.success(t('trash.restored', { title: card.title })),
                      onError: (e) => toast.error(errorText(e)),
                    })
                  }
                >
                  <ArchiveRestore />
                  {t('trash.restore')}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
