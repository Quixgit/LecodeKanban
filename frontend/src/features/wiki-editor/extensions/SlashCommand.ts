import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { LucideIcon } from 'lucide-react';
import { SlashMenu, type SlashMenuHandle } from '../components/SlashMenu';

export interface SlashItem {
  id: string;
  title: string;
  description: string;
  group: string;
  keywords: string[];
  icon: LucideIcon;
  run: (editor: Editor, range: Range) => void;
}

export interface SlashOptions {
  /** Items for the typed query; read through a ref so labels follow the language. */
  getItems: (query: string) => SlashItem[];
}

/** Typing "/" at the start of a block (or after a space) opens the block picker. */
export const SlashCommand = Extension.create<SlashOptions>({
  name: 'slashCommand',

  addOptions() {
    return { getItems: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        allowedPrefixes: [' '],
        items: ({ query }) => this.options.getItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let component: ReactRenderer<
            SlashMenuHandle,
            SuggestionProps<SlashItem, SlashItem>
          > | null = null;

          const place = (props: SuggestionProps<SlashItem, SlashItem>) => {
            const rect = props.clientRect?.();
            if (!rect || !component) return;
            const el = component.element as HTMLElement;
            const reference = { getBoundingClientRect: () => rect };
            void computePosition(reference, el, {
              placement: 'bottom-start',
              strategy: 'fixed',
              middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
            }).then(({ x, y }) => {
              el.style.left = `${x}px`;
              el.style.top = `${y}px`;
            });
          };

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
              const el = component.element as HTMLElement;
              el.classList.add('lk-slash-popup');
              el.style.position = 'fixed';
              document.body.appendChild(el);
              place(props);
            },
            onUpdate: (props) => {
              component?.updateProps(props);
              place(props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') return false; // Suggestion closes the menu itself
              return component?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              component?.element.remove();
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
