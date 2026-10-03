import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutView } from '../components/CalloutView';

export const CALLOUT_TYPES = ['info', 'warning', 'danger', 'success'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
      toggleCallout: (type?: CalloutType) => ReturnType;
    };
  }
}

const MD_TAG: Record<CalloutType, string> = {
  info: 'INFO',
  warning: 'WARNING',
  danger: 'DANGER',
  success: 'SUCCESS',
};
const fromTag = (tag: string) =>
  (CALLOUT_TYPES.find((t) => MD_TAG[t] === tag.toUpperCase()) ?? 'info') as CalloutType;

/**
 * Highlighted block (info / warning / danger / success). In Markdown it is a GitHub-style alert:
 *   > [!WARNING]
 *   > text
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (el) => fromTag(el.getAttribute('data-callout') ?? 'info'),
        renderHTML: (attrs) => ({ 'data-callout': attrs.type as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'lk-callout' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (type = 'info') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type }),
      toggleCallout:
        (type = 'info') =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { type }),
    };
  },

  markdownTokenizer: {
    name: 'callout',
    level: 'block',
    start: (src) => src.search(/^> \[!(INFO|WARNING|DANGER|SUCCESS)\]/im),
    tokenize(src, _tokens, lexer) {
      const m = /^> \[!(INFO|WARNING|DANGER|SUCCESS)\][ \t]*(?:\n|$)((?:>.*(?:\n|$))*)/i.exec(src);
      if (!m) return undefined;
      const inner = (m[2] ?? '')
        .split('\n')
        .map((line) => line.replace(/^> ?/, ''))
        .join('\n');
      return {
        type: 'callout',
        raw: m[0],
        calloutType: fromTag(m[1]!),
        tokens: lexer.blockTokens(inner),
      };
    },
  },

  parseMarkdown(token, helpers) {
    const kids = helpers.parseChildren(token.tokens ?? []);
    return helpers.createNode(
      'callout',
      { type: (token as { calloutType?: CalloutType }).calloutType ?? 'info' },
      kids.length ? kids : [helpers.createNode('paragraph')],
    );
  },

  renderMarkdown(node, helpers) {
    const body = helpers.renderChildren(node.content ?? [], '\n\n');
    const lines = body.split('\n').map((l: string) => (l ? `> ${l}` : '>'));
    return `> [!${MD_TAG[fromTag(String(node.attrs?.type ?? 'info'))]}]\n${lines.join('\n')}`;
  },
});
