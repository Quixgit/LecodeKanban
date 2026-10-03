import type { Editor } from '@tiptap/core';
import { useEffect, useState } from 'react';

/** Headings of the document, kept in sync as the page changes. */
export interface OutlineItem {
  pos: number;
  level: number;
  text: string;
}

export function useOutline(editor: Editor | null): OutlineItem[] {
  const [items, setItems] = useState<OutlineItem[]>([]);
  useEffect(() => {
    if (!editor) return;
    let timer: number | undefined;
    const compute = () => {
      const next: OutlineItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.textContent.trim()) {
          next.push({ pos, level: node.attrs.level as number, text: node.textContent });
        }
      });
      setItems((prev) =>
        prev.length === next.length &&
        prev.every(
          (p, i) =>
            p.pos === next[i]!.pos && p.text === next[i]!.text && p.level === next[i]!.level,
        )
          ? prev
          : next,
      );
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(compute, 200);
    };
    compute();
    editor.on('update', schedule);
    return () => {
      window.clearTimeout(timer);
      editor.off('update', schedule);
    };
  }, [editor]);
  return items;
}
