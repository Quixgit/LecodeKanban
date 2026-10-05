import { modKeyLabel } from './platform';

/** The keyboard shortcuts of the platform, in one place: the "?" dialog, the pages and the Help page read from here. */

/** "g" then a letter jumps to a page. */
export const GO_SHORTCUTS = [
  { key: 'd', to: '/', label: 'dashboard' },
  { key: 'p', to: '/projects', label: 'projects' },
  { key: 't', to: '/tasks', label: 'tasks' },
  { key: 'l', to: '/calendar', label: 'calendar' },
  { key: 'c', to: '/chat', label: 'chat' },
  { key: 'o', to: '/docs', label: 'docs' },
  { key: 'm', to: '/team', label: 'team' },
  { key: 's', to: '/settings', label: 'settings' },
] as const;

/** The task board. */
export const BOARD_KEYS = {
  newCard: ['N'],
  search: ['/'],
  navigate: ['↑', '↓', '←', '→'],
  open: ['Enter'],
  drag: ['Space'],
  cancel: ['Esc'],
} as const;

const MOD = modKeyLabel;
const ALT = 'Alt';
const SHIFT = '⇧';

/** Keys per shortcut id of the document editor; labels come from the wikiEditor translations. */
export const EDITOR_SHORTCUTS: { id: string; items: { id: string; keys: string[] }[] }[] = [
  {
    id: 'text',
    items: [
      { id: 'bold', keys: [MOD, 'B'] },
      { id: 'italic', keys: [MOD, 'I'] },
      { id: 'underline', keys: [MOD, 'U'] },
      { id: 'strike', keys: [MOD, SHIFT, 'S'] },
      { id: 'code', keys: [MOD, 'E'] },
      { id: 'highlight', keys: [MOD, SHIFT, 'H'] },
      { id: 'link', keys: [MOD, 'K'] },
      { id: 'paragraph', keys: [MOD, ALT, '0'] },
      { id: 'heading', keys: [MOD, ALT, '1–4'] },
    ],
  },
  {
    id: 'blocks',
    items: [
      { id: 'slash', keys: ['/'] },
      { id: 'bullet', keys: [MOD, SHIFT, '8'] },
      { id: 'ordered', keys: [MOD, SHIFT, '7'] },
      { id: 'task', keys: [MOD, SHIFT, '9'] },
      { id: 'quote', keys: [MOD, SHIFT, 'B'] },
      { id: 'codeBlock', keys: [MOD, ALT, 'C'] },
      { id: 'indent', keys: ['Tab'] },
      { id: 'outdent', keys: [SHIFT, 'Tab'] },
    ],
  },
  {
    id: 'editing',
    items: [
      { id: 'undo', keys: [MOD, 'Z'] },
      { id: 'redo', keys: [MOD, SHIFT, 'Z'] },
      { id: 'plain', keys: [MOD, SHIFT, 'V'] },
      { id: 'hardBreak', keys: [SHIFT, 'Enter'] },
    ],
  },
];

/** Markdown typed in the editor turns into formatting. */
export const MARKDOWN_SHORTCUTS = [
  '# ',
  '## ',
  '- ',
  '1. ',
  '[] ',
  '> ',
  '```',
  '---',
  '**x**',
  '`x`',
];
