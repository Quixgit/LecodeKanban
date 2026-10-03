import type { Editor } from '@tiptap/core';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { OutlineItem } from '../hooks/useOutline';

export function OutlinePanel({ editor, items }: { editor: Editor; items: OutlineItem[] }) {
  const { t } = useTranslation('wikiEditor');
  const caret = editor.state.selection.from;
  const current = [...items].reverse().find((i) => i.pos <= caret)?.pos;

  const go = (pos: number) => {
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .run();
    const dom = editor.view.nodeDOM(pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <nav aria-label={t('outline.title')} className="lk-outline">
      <h2 className="lk-outline-title">{t('outline.title')}</h2>
      {items.length === 0 ? (
        <p className="lk-outline-empty">{t('outline.empty')}</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.pos}>
              <button
                type="button"
                onClick={() => go(i.pos)}
                aria-current={i.pos === current ? 'location' : undefined}
                className={cn('lk-outline-item', i.pos === current && 'is-current')}
                style={{ paddingLeft: `${(i.level - 1) * 12 + 8}px` }}
              >
                {i.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
