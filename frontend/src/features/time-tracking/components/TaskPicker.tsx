import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardList } from '@/features/cards';
import { useCurrentWorkspace } from '@/features/workspaces';
import { cn } from '@/shared/lib/cn';
import { Input } from '@/shared/ui';

export interface PickedTask {
  id: string;
  key: string;
  title: string;
}

/** Find a task to put time on: type a title or key, pick from the matches. */
export function TaskPicker({
  value,
  onChange,
  id,
  invalid,
}: {
  value: PickedTask | null;
  onChange: (t: PickedTask | null) => void;
  id?: string;
  invalid?: boolean;
}) {
  const { t } = useTranslation('time');
  const { workspace } = useCurrentWorkspace();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(text.trim()), 200);
    return () => window.clearTimeout(h);
  }, [text]);
  const results = useCardList(workspace?.id, { q: debounced || undefined, pageSize: 6 }, !value);

  if (value) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => onChange(null)}
        className="flex h-control w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-base hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="tabular shrink-0 text-sm font-medium text-text-muted">{value.key}</span>
        <span className="truncate text-text">{value.title}</span>
      </button>
    );
  }
  const items = results.data?.items ?? [];
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        invalid={invalid}
        leadingIcon={<Search />}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('dialog.taskPlaceholder')}
        autoComplete="off"
      />
      <ul className="max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-surface">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onChange({ id: c.id, key: c.key, title: c.title })}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none',
              )}
            >
              <span className="tabular shrink-0 text-xs font-medium text-text-muted">{c.key}</span>
              <span className="truncate text-text">{c.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
