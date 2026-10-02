import { Bold, Code, Italic, Link2, List, ListChecks } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Markdown, SegmentedControl } from '@/shared/ui';

type Mode = 'write' | 'preview';

const tools = [
  { icon: Bold, key: 'bold', wrap: ['**', '**'] },
  { icon: Italic, key: 'italic', wrap: ['_', '_'] },
  { icon: Code, key: 'code', wrap: ['`', '`'] },
  { icon: Link2, key: 'link', wrap: ['[', '](https://)'] },
  { icon: List, key: 'list', prefix: '- ' },
  { icon: ListChecks, key: 'task', prefix: '- [ ] ' },
] as const;

/** Markdown description: rendered by default; Edit opens a textarea with a tiny toolbar. */
export function DescriptionEditor({
  value,
  editable,
  saving,
  onSave,
}: {
  value: string;
  editable: boolean;
  saving: boolean;
  onSave: (v: string) => Promise<unknown>;
}) {
  const { t } = useTranslation('card');
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>('write');
  const [draft, setDraft] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const apply = (tool: (typeof tools)[number]) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = draft.slice(s, e);
    let next: string;
    let caret: number;
    if ('prefix' in tool) {
      const lineStart = draft.lastIndexOf('\n', s - 1) + 1;
      next = draft.slice(0, lineStart) + tool.prefix + draft.slice(lineStart);
      caret = e + tool.prefix.length;
    } else {
      const [open, close] = tool.wrap;
      next = draft.slice(0, s) + open + selected + close + draft.slice(e);
      caret = s + open.length + selected.length;
    }
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };
  const save = async () => {
    if (draft !== value) await onSave(draft);
    setEditing(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(value);
      setEditing(false);
    }
  };

  if (!editing) {
    return value ? (
      <div
        className={
          editable ? '-m-2 cursor-text rounded-lg p-2 hover:bg-surface-muted/60' : undefined
        }
        onClick={(e) => editable && !(e.target as HTMLElement).closest('a') && setEditing(true)}
      >
        <Markdown source={value} />
      </div>
    ) : editable ? (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full rounded-lg border border-dashed border-border px-3 py-4 text-left text-sm text-text-muted hover:border-border-strong hover:text-text-secondary"
      >
        {t('description.empty')}
      </button>
    ) : (
      <p className="text-sm text-text-muted">{t('description.none')}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2 shadow-xs">
      <div className="flex flex-wrap items-center gap-1">
        <SegmentedControl<Mode>
          label={t('description.mode')}
          value={mode}
          onChange={setMode}
          className="h-8 [&_button]:px-2.5 [&_button]:text-sm"
          options={[
            { value: 'write', label: t('description.write') },
            { value: 'preview', label: t('description.preview') },
          ]}
        />
        {mode === 'write' &&
          tools.map((tool) => (
            <IconButton
              key={tool.key}
              variant="ghost"
              size="sm"
              label={t(`description.tools.${tool.key}`)}
              onClick={() => apply(tool)}
            >
              <tool.icon />
            </IconButton>
          ))}
      </div>
      {mode === 'write' ? (
        <textarea
          ref={area}
          autoFocus
          rows={8}
          maxLength={50000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t('description.label')}
          placeholder={t('description.placeholder')}
          className="min-h-40 w-full resize-y rounded-md bg-transparent px-1 font-mono text-sm text-text placeholder:text-text-faint focus:outline-none"
        />
      ) : (
        <div className="min-h-40 px-1">
          {draft ? (
            <Markdown source={draft} />
          ) : (
            <p className="text-sm text-text-muted">{t('description.nothing')}</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" loading={saving} onClick={() => void save()}>
          {t('save')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          {t('cancel')}
        </Button>
        <span className="ml-auto text-2xs text-text-faint">{t('description.hint')}</span>
      </div>
    </div>
  );
}
