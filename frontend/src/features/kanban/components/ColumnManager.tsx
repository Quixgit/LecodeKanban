import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { ConfirmDialog, toast } from '@/shared/ui';
import { useColumnMutations } from '../hooks/useBoard';
import type { ColumnDef } from '../model/board';
import { ColumnDialog, type ColumnDraft } from './ColumnDialog';
import type { ColumnAction } from './ColumnHeader';

export interface ColumnManagerHandle {
  act: (column: ColumnDef, action: ColumnAction) => void;
  add: () => void;
}

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; column: ColumnDef; focus: 'name' | 'wip' }
  | { kind: 'delete'; column: ColumnDef };

/** Dialogs and API calls behind the column menu of a project board. */
export const ColumnManager = forwardRef<
  ColumnManagerHandle,
  { projectId: string; workspaceId: string; columns: ColumnDef[] }
>(function ColumnManager({ projectId, workspaceId, columns }, ref) {
  const { t } = useTranslation('kanban');
  const errorText = useErrorText();
  const m = useColumnMutations(projectId, workspaceId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string>();
  const close = () => {
    setDialog(null);
    setError(undefined);
  };
  const fail = (e: unknown) => setError(errorText(e));

  useImperativeHandle(ref, () => ({
    add: () => setDialog({ kind: 'add' }),
    act: (column, action) => {
      const i = columns.findIndex((c) => c.key === column.key);
      switch (action) {
        case 'edit':
        case 'wip':
          setDialog({ kind: 'edit', column, focus: action === 'wip' ? 'wip' : 'name' });
          break;
        case 'delete':
          setDialog({ kind: 'delete', column });
          break;
        case 'left':
        case 'right': {
          const to =
            action === 'left'
              ? { beforeId: columns[i - 1]?.key }
              : { afterId: columns[i + 1]?.key };
          m.move.mutate({ id: column.key, to }, { onError: (e) => toast.error(errorText(e)) });
        }
      }
    },
  }));

  const submit = (d: ColumnDraft) => {
    if (dialog?.kind === 'add') {
      m.create.mutate(
        { name: d.name, status: d.status, wipLimit: d.wipLimit },
        {
          onSuccess: (c) => {
            toast.success(t('column.created', { name: c.name }));
            close();
          },
          onError: fail,
        },
      );
    } else if (dialog?.kind === 'edit') {
      m.update.mutate(
        { id: dialog.column.key, patch: { name: d.name, wipLimit: d.wipLimit } },
        { onSuccess: close, onError: fail },
      );
    }
  };

  const editing = dialog?.kind === 'edit' ? dialog : null;
  return (
    <>
      <ColumnDialog
        open={dialog?.kind === 'add' || dialog?.kind === 'edit'}
        onOpenChange={(o) => !o && close()}
        initial={
          editing
            ? {
                name: editing.column.name,
                status: editing.column.status,
                wipLimit: editing.column.wipLimit,
              }
            : undefined
        }
        focus={editing?.focus}
        busy={m.create.isPending || m.update.isPending}
        error={error}
        onSubmit={submit}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(o) => !o && close()}
        danger
        title={t('column.deleteTitle', {
          name: dialog?.kind === 'delete' ? dialog.column.name : '',
        })}
        description={t('column.deleteBody')}
        confirmLabel={t('column.delete')}
        loading={m.remove.isPending}
        onConfirm={() =>
          dialog?.kind === 'delete' &&
          m.remove.mutate(dialog.column.key, {
            onSuccess: close,
            onError: (e) => {
              toast.error(errorText(e));
              close();
            },
          })
        }
      />
    </>
  );
});
