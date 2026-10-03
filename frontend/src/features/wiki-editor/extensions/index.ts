import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Youtube } from '@tiptap/extension-youtube';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import 'katex/dist/katex.min.css';
import { isSafeLink } from '../lib/sanitize';
import { Callout } from './Callout';
import { CodeBlock } from './CodeBlock';
import { FileAttachment } from './FileAttachment';
import { MarkdownLink } from './MarkdownLink';
import { SlashCommand, type SlashItem } from './SlashCommand';

interface Options {
  placeholder: (kind: 'heading' | 'block') => string;
  getSlashItems: (query: string) => SlashItem[];
}

/** The page editor's schema: everything the server's document allow-list accepts. */
export function buildExtensions({ placeholder, getSlashItems }: Options) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: false, // replaced by the lowlight block below
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => isSafeLink(url),
      },
      dropcursor: { class: 'lk-dropcursor', width: 2 },
    }),
    CodeBlock,
    Highlight,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Image.configure({ allowBase64: false }),
    Youtube.configure({ nocookie: true, controls: true, modestBranding: true }),
    Details.configure({ persist: true }),
    DetailsSummary,
    DetailsContent,
    Mathematics,
    Callout,
    FileAttachment,
    MarkdownLink,
    Placeholder.configure({
      showOnlyCurrent: true,
      placeholder: ({ node }) => placeholder(node.type.name === 'heading' ? 'heading' : 'block'),
    }),
    CharacterCount,
    Markdown,
    SlashCommand.configure({ getItems: getSlashItems }),
  ];
}
