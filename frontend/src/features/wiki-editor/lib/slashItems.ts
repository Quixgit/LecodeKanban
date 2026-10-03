import type { Editor, Range } from '@tiptap/core';
import {
  ChevronsDownUp,
  CircleAlert,
  CircleCheck,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image,
  Info,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Sigma,
  Table,
  TriangleAlert,
  Video,
  Workflow,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SlashItem } from '../extensions/SlashCommand';

export interface SlashContext {
  t: TFunction;
  /** Opens the file picker (images or any file) and inserts the result at the caret. */
  pickFile: (kind: 'image' | 'file') => void;
  /** Opens the YouTube URL dialog. */
  askVideo: () => void;
}

const MERMAID_SAMPLE =
  'graph TD\n  A[Start] --> B{Check}\n  B -->|ok| C[Done]\n  B -->|fail| D[Retry]';

/** Every block the "/" menu offers, in display order, in the active language. */
export function slashItems({ t, pickFile, askVideo }: SlashContext): SlashItem[] {
  const text = t('wikiEditor:slash.groups.text');
  const lists = t('wikiEditor:slash.groups.lists');
  const blocks = t('wikiEditor:slash.groups.blocks');
  const media = t('wikiEditor:slash.groups.media');
  const chain = (e: Editor, r: Range) => e.chain().focus().deleteRange(r);
  const item = (
    id: string,
    group: string,
    icon: SlashItem['icon'],
    run: SlashItem['run'],
    keywords: string[] = [],
  ): SlashItem => ({
    id,
    group,
    icon,
    run,
    title: t(`slash.items.${id}.title`),
    description: t(`slash.items.${id}.description`),
    keywords,
  });

  return [
    item('paragraph', text, Pilcrow, (e, r) => chain(e, r).setParagraph().run(), [
      'text',
      'p',
      'текст',
    ]),
    item('h1', text, Heading1, (e, r) => chain(e, r).setHeading({ level: 1 }).run(), [
      'heading',
      'title',
      'заголовок',
    ]),
    item('h2', text, Heading2, (e, r) => chain(e, r).setHeading({ level: 2 }).run(), [
      'heading',
      'заголовок',
    ]),
    item('h3', text, Heading3, (e, r) => chain(e, r).setHeading({ level: 3 }).run(), [
      'heading',
      'заголовок',
    ]),
    item('h4', text, Heading4, (e, r) => chain(e, r).setHeading({ level: 4 }).run(), [
      'heading',
      'заголовок',
    ]),
    item('bullet', lists, List, (e, r) => chain(e, r).toggleBulletList().run(), [
      'list',
      'ul',
      'список',
    ]),
    item('ordered', lists, ListOrdered, (e, r) => chain(e, r).toggleOrderedList().run(), [
      'list',
      'ol',
      'нумерований',
    ]),
    item('task', lists, ListChecks, (e, r) => chain(e, r).toggleTaskList().run(), [
      'todo',
      'checkbox',
      'завдання',
    ]),
    item('quote', blocks, Quote, (e, r) => chain(e, r).setBlockquote().run(), [
      'blockquote',
      'цитата',
    ]),
    item('divider', blocks, Minus, (e, r) => chain(e, r).setHorizontalRule().run(), [
      'hr',
      'line',
      'розділювач',
    ]),
    item('code', blocks, Code, (e, r) => chain(e, r).setCodeBlock().run(), [
      'code',
      'snippet',
      'код',
    ]),
    item(
      'diagram',
      blocks,
      Workflow,
      (e, r) =>
        chain(e, r)
          .insertContent({
            type: 'codeBlock',
            attrs: { language: 'mermaid' },
            content: [{ type: 'text', text: MERMAID_SAMPLE }],
          })
          .run(),
      ['mermaid', 'flowchart', 'diagram', 'діаграма'],
    ),
    item('info', blocks, Info, (e, r) => chain(e, r).setCallout('info').run(), [
      'callout',
      'note',
      'виноска',
    ]),
    item('warning', blocks, TriangleAlert, (e, r) => chain(e, r).setCallout('warning').run(), [
      'callout',
      'warn',
      'попередження',
    ]),
    item('danger', blocks, CircleAlert, (e, r) => chain(e, r).setCallout('danger').run(), [
      'callout',
      'error',
      'небезпека',
    ]),
    item('success', blocks, CircleCheck, (e, r) => chain(e, r).setCallout('success').run(), [
      'callout',
      'ok',
      'успіх',
    ]),
    item('toggle', blocks, ChevronsDownUp, (e, r) => chain(e, r).setDetails().run(), [
      'details',
      'collapse',
      'спойлер',
    ]),
    item(
      'table',
      blocks,
      Table,
      (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      ['grid', 'таблиця'],
    ),
    item(
      'math',
      blocks,
      Sigma,
      (e, r) =>
        chain(e, r)
          .insertContent({ type: 'blockMath', attrs: { latex: 'E = mc^2' } })
          .run(),
      ['latex', 'formula', 'формула'],
    ),
    item(
      'image',
      media,
      Image,
      (e, r) => {
        chain(e, r).run();
        pickFile('image');
      },
      ['picture', 'photo', 'зображення'],
    ),
    item(
      'file',
      media,
      Paperclip,
      (e, r) => {
        chain(e, r).run();
        pickFile('file');
      },
      ['attachment', 'upload', 'файл'],
    ),
    item(
      'video',
      media,
      Video,
      (e, r) => {
        chain(e, r).run();
        askVideo();
      },
      ['youtube', 'embed', 'відео'],
    ),
  ];
}

/** Items matching a typed query (title, description and keywords, case-insensitive). */
export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const score = (i: SlashItem) => {
    const title = i.title.toLowerCase();
    if (title.startsWith(q)) return 0;
    if (title.includes(q)) return 1;
    if (i.keywords.some((k) => k.startsWith(q))) return 2;
    if (i.keywords.some((k) => k.includes(q)) || i.description.toLowerCase().includes(q)) return 3;
    return -1;
  };
  return items
    .map((i) => ({ i, s: score(i) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map((x) => x.i);
}
