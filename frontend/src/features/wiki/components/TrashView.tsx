import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { formatRelative } from '@/shared/lib/format';
import { Button, ConfirmDialog, EmptyState, Skeleton, toast } from '@/shared/ui';
import { useTrash, useWikiMutations } from '../hooks/useWiki';
import { can } from '../model/permissions';
import type { WikiTrashItem } from '../api/wikiApi';
import { NodeIcon } from './NodeIcon';

const DAY = 86_400_000;

/** Deleted subtrees kept for 30 days: restore, or delete for good (owners). */
export function TrashView({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation('wiki');
  const errorText = useErrorText();
  const trash = useTrash(workspaceId);
  const m = useWikiMutations(workspaceId);
  const [purging, setPurging] = useState<WikiTrashItem | null>(null);

  const restore = (item: WikiTrashItem) =>
    m.restoreNode.mutate(item.node.id, {
      onSuccess: () => toast.success(t('trash.restored', { title: item.node.title })),
      onError: (e) => toast.error(errorText(e)),
    });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
      <header>
        <h2 className="text-xl font-semibold text-text">{t('trash.title')}</h2>
        <p className="mt-1 text-base text-text-muted">{t('trash.description')}</p>
      </header>

      {trash.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : trash.isError ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-base text-text-secondary">{errorText(trash.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => trash.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : trash.data.length === 0 ? (
        <EmptyState
          icon={<Trash2 />}
          title={t('trash.emptyTitle')}
          description={t('trash.emptyDescription')}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface">
          {trash.data.map((item) => {
            const left = Math.max(
              0,
              Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / DAY),
            );
            return (
              <li key={item.node.id} className="flex items-center gap-3 px-4 py-3">
                <NodeIcon node={item.node} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-text">{item.node.title}</p>
                  <p className="text-sm text-text-muted">
                    {t('trash.meta', {
                      when: item.node.deletedAt
                        ? formatRelative(item.node.deletedAt, i18n.language)
                        : '',
                      count: left,
                    })}
                  </p>
                </div>
                {can.edit(item.node.access.role) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={m.restoreNode.isPending && m.restoreNode.variables === item.node.id}
                    onClick={() => restore(item)}
                  >
                    <RotateCcw />
                    {t('trash.restore')}
                  </Button>
                )}
                {can.manage(item.node.access.role) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-ink"
                    onClick={() => setPurging(item)}
                  >
                    {t('trash.purge')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!purging}
        onOpenChange={(o) => !o && setPurging(null)}
        title={t('trash.purgeTitle', { title: purging?.node.title ?? '' })}
        description={t('trash.purgeDescription')}
        confirmLabel={t('trash.purge')}
        loading={m.purgeNode.isPending}
        onConfirm={() =>
          purging &&
          m.purgeNode.mutate(purging.node.id, {
            onSuccess: () => setPurging(null),
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </div>
  );
}
