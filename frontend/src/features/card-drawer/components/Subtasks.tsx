import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useCardList, useCardMutations, type Card } from '@/features/cards';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { AvatarGroup, Button, Checkbox, ProgressBar, Skeleton, toast } from '@/shared/ui';

/** Child cards of a card: tick to complete, click to open, add inline. */
export function Subtasks({
  card,
  workspaceId,
  editable,
}: {
  card: Card;
  workspaceId: string;
  editable: boolean;
}) {
  const { t } = useTranslation('card');
  const errorText = useErrorText();
  const [, setParams] = useSearchParams();
  const [text, setText] = useState('');
  const list = useCardList(workspaceId, { parentId: card.id, sort: 'key', pageSize: 100 });
  const { create, move } = useCardMutations(workspaceId);
  const items = list.data?.items ?? [];
  const { total, done } = card.subtasks;

  const open = (id: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('card', id);
      return next;
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = text.trim();
    if (!title) return;
    create.mutate(
      { projectId: card.project.id, parentId: card.id, title },
      { onSuccess: () => setText(''), onError: (err) => toast.error(errorText(err)) },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar
            value={(done / total) * 100}
            size="sm"
            label={t('subtasks.progress', { done, total })}
          />
          <span className="tabular shrink-0 text-xs text-text-muted">
            {done}/{total}
          </span>
        </div>
      )}
      {list.isPending && total > 0 && <Skeleton className="h-9 rounded-lg" />}
      <ul className="flex flex-col">
        {items.map((s) => (
          <li
            key={s.id}
            className="group/sub flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-muted"
          >
            <Checkbox
              checked={s.status === 'done'}
              disabled={!editable || move.isPending}
              aria-label={t('subtasks.toggle', { title: s.title })}
              onCheckedChange={(v) =>
                move.mutate(
                  { card: s, move: { status: v ? 'done' : 'todo' } },
                  { onError: (err) => toast.error(errorText(err)) },
                )
              }
            />
            <button
              type="button"
              onClick={() => open(s.id)}
              className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
            >
              <span className="tabular shrink-0 text-xs text-text-muted">{s.key}</span>
              <span
                className={cn(
                  'truncate text-base text-text',
                  s.status === 'done' && 'text-text-muted line-through',
                )}
              >
                {s.title}
              </span>
            </button>
            {s.assignees.length > 0 && (
              <AvatarGroup
                size="xs"
                max={2}
                people={s.assignees.map((a) => ({ name: a.name, src: a.avatarUrl }))}
              />
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('subtasks.add')}
            aria-label={t('subtasks.add')}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={create.isPending}
            disabled={!text.trim()}
          >
            <Plus />
            {t('subtasks.addButton')}
          </Button>
        </form>
      )}
    </div>
  );
}
