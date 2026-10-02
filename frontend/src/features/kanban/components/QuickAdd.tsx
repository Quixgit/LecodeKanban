import { Plus } from 'lucide-react';
import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select } from '@/shared/ui';

export interface QuickAddHandle {
  open: () => void;
}

interface Props {
  /** Present on the all-projects board, where a new card needs a project. */
  projects?: { id: string; name: string; key: string }[];
  projectId?: string;
  onProjectChange?: (id: string) => void;
  busy: boolean;
  onCreate: (title: string) => Promise<unknown>;
}

/** Inline "+ Add task" at the bottom of a column; stays open for rapid entry. */
export const QuickAdd = forwardRef<QuickAddHandle, Props>(function QuickAdd(
  { projects, projectId, onProjectChange, busy, onCreate },
  ref,
) {
  const { t } = useTranslation('kanban');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      requestAnimationFrame(() => input.current?.focus());
    },
  }));

  const submit = async () => {
    const text = title.trim();
    if (!text || busy || (projects && !projectId)) return;
    try {
      await onCreate(text);
      setTitle('');
      input.current?.focus();
    } catch {
      // The caller reports the error; keep the text so nothing is lost.
    }
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setTitle('');
    }
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        block
        className="mt-1 justify-start text-text-muted opacity-0 transition-opacity duration-micro focus-visible:opacity-100 group-focus-within/cell:opacity-100 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-100"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <Plus />
        {t('quickAdd.button')}
      </Button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-primary-border bg-surface p-2 shadow-sm">
      <textarea
        ref={input}
        rows={2}
        maxLength={300}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('quickAdd.placeholder')}
        aria-label={t('quickAdd.placeholder')}
        className="w-full resize-none bg-transparent text-base text-text placeholder:text-text-faint focus:outline-none"
      />
      {projects && (
        <Select
          className="h-8 w-full justify-between text-sm"
          label={t('quickAdd.project')}
          placeholder={t('quickAdd.project')}
          value={projectId}
          onValueChange={onProjectChange}
          options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
        />
      )}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          loading={busy}
          disabled={!title.trim() || (!!projects && !projectId)}
          onClick={() => void submit()}
        >
          {t('quickAdd.submit')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setTitle('');
          }}
        >
          {t('quickAdd.cancel')}
        </Button>
        <span className="ml-auto text-2xs text-text-faint">{t('quickAdd.hint')}</span>
      </div>
    </div>
  );
});
