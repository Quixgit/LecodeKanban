import type { SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import type { SlashItem } from '../extensions/SlashCommand';

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** The "/" block picker: filtered list, arrow keys + Enter, grouped by kind. */
export const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashItem, SlashItem>>(
  function SlashMenu({ items, command }, ref) {
    const { t } = useTranslation('wikiEditor');
    const [index, setIndex] = useState(0);
    const listId = useId();
    const active = useRef<HTMLButtonElement>(null);

    useEffect(() => setIndex(0), [items]);
    useEffect(() => active.current?.scrollIntoView({ block: 'nearest' }), [index]);

    useImperativeHandle(ref, () => ({
      onKeyDown: (e) => {
        if (items.length === 0) return false;
        if (e.key === 'ArrowDown') {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          const item = items[index];
          if (item) command(item);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="lk-slash" role="status">
          <p className="lk-slash-empty">{t('slash.empty')}</p>
        </div>
      );
    }

    let lastGroup = '';
    return (
      <div className="lk-slash" role="listbox" id={listId} aria-label={t('slash.label')}>
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <div key={item.id}>
              {header && <p className="lk-slash-group">{header}</p>}
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                ref={i === index ? active : undefined}
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(e) => e.preventDefault()} // keep the editor selection
                onClick={() => command(item)}
                className={cn('lk-slash-item', i === index && 'is-active')}
              >
                <span className="lk-slash-icon">
                  <Icon aria-hidden />
                </span>
                <span className="lk-slash-text">
                  <span className="lk-slash-title">{item.title}</span>
                  <span className="lk-slash-desc">{item.description}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  },
);
