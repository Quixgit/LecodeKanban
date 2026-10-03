import { Extension, InputRule } from '@tiptap/core';
import { isSafeLink } from '../lib/sanitize';

/** Typing [text](https://example.com) turns into a link, like in Markdown. */
export const MarkdownLink = Extension.create({
  name: 'markdownLink',
  addInputRules() {
    return [
      new InputRule({
        find: /\[([^\][]+)\]\(([^)\s]+)\)$/,
        handler: ({ range, match, chain }) => {
          const [, text, href] = match as unknown as [string, string, string];
          if (!isSafeLink(href)) return null;
          chain()
            .deleteRange(range)
            .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
            .run();
          return undefined;
        },
      }),
    ];
  },
});
