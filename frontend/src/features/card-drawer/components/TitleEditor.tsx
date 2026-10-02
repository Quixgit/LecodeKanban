import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';

/** The card title, edited in place: Enter or blur saves, Esc reverts. */
export function TitleEditor({
  value,
  editable,
  onSave,
}: {
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
}) {
  const { t } = useTranslation('card');
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const commit = () => {
    const next = draft.trim();
    if (!next) setDraft(value);
    else if (next !== value) onSave(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(value);
      requestAnimationFrame(() => ref.current?.blur());
    }
  };

  if (!editable) return <h2 className="text-xl font-semibold text-text">{value}</h2>;
  return (
    <textarea
      ref={ref}
      rows={1}
      maxLength={300}
      value={draft}
      aria-label={t('title')}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        '-mx-2 w-full resize-none overflow-hidden rounded-lg bg-transparent px-2 py-1 text-xl font-semibold text-text',
        'transition-colors duration-micro hover:bg-surface-muted focus:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    />
  );
}
