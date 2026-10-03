import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { modKeyLabel } from '@/shared/lib/platform';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from '@/shared/ui';
import type { SlashItem } from '../extensions/SlashCommand';
import { ToolbarButton } from './ToolbarButton';

const M = modKeyLabel;
const ALIGNS: { id: 'left' | 'center' | 'right' | 'justify'; icon: LucideIcon }[] = [
  { id: 'left', icon: AlignLeft },
  { id: 'center', icon: AlignCenter },
  { id: 'right', icon: AlignRight },
  { id: 'justify', icon: AlignJustify },
];

interface Props {
  editor: Editor;
  insertItems: SlashItem[];
  onLink: () => void;
}

/** The fixed formatting bar shown while editing. */
export function Toolbar({ editor, insertItems, onLink }: Props) {
  const { t } = useTranslation('wikiEditor');
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
      sub: e.isActive('subscript'),
      sup: e.isActive('superscript'),
      link: e.isActive('link'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      inTable: e.isActive('table'),
      level: ([1, 2, 3, 4] as const).find((l) => e.isActive('heading', { level: l })) ?? 0,
      align: ALIGNS.find((a) => e.isActive({ textAlign: a.id }))?.id ?? 'left',
    }),
  });
  const run = () => editor.chain().focus();
  const AlignIcon = ALIGNS.find((a) => a.id === s.align)?.icon ?? AlignLeft;
  const caret = editor.state.selection.from;

  const groups = [
    t('wikiEditor:slash.groups.text'),
    t('wikiEditor:slash.groups.lists'),
    t('wikiEditor:slash.groups.blocks'),
    t('wikiEditor:slash.groups.media'),
  ];

  return (
    <div className="lk-toolbar" role="toolbar" aria-label={t('toolbar.label')}>
      <ToolbarButton
        label={t('toolbar.undo')}
        keys={[M, 'Z']}
        disabled={!s.canUndo}
        onClick={() => run().undo().run()}
      >
        <Undo2 aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.redo')}
        keys={[M, '⇧', 'Z']}
        disabled={!s.canRedo}
        onClick={() => run().redo().run()}
      >
        <Redo2 aria-hidden />
      </ToolbarButton>
      <span className="lk-tb-sep" aria-hidden />

      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="lk-tb lk-tb-wide"
            aria-label={t('toolbar.textStyle')}
            onMouseDown={(e) => e.preventDefault()}
          >
            {s.level ? t(`toolbar.heading${s.level}`) : t('toolbar.paragraph')}
            <ChevronDown aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownItem onSelect={() => run().setParagraph().run()}>
            {t('toolbar.paragraph')}
          </DropdownItem>
          {([1, 2, 3, 4] as const).map((l) => (
            <DropdownItem key={l} onSelect={() => run().toggleHeading({ level: l }).run()}>
              <span className={cn(s.level === l && 'font-semibold text-primary-ink')}>
                {t(`toolbar.heading${l}`)}
              </span>
            </DropdownItem>
          ))}
        </DropdownContent>
      </Dropdown>
      <span className="lk-tb-sep" aria-hidden />

      <ToolbarButton
        label={t('toolbar.bold')}
        keys={[M, 'B']}
        active={s.bold}
        onClick={() => run().toggleBold().run()}
      >
        <Bold aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.italic')}
        keys={[M, 'I']}
        active={s.italic}
        onClick={() => run().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.underline')}
        keys={[M, 'U']}
        active={s.underline}
        onClick={() => run().toggleUnderline().run()}
      >
        <Underline aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.strike')}
        keys={[M, '⇧', 'S']}
        active={s.strike}
        onClick={() => run().toggleStrike().run()}
      >
        <Strikethrough aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.code')}
        keys={[M, 'E']}
        active={s.code}
        onClick={() => run().toggleCode().run()}
      >
        <Code aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.highlight')}
        keys={[M, '⇧', 'H']}
        active={s.highlight}
        onClick={() => run().toggleHighlight().run()}
      >
        <Highlighter aria-hidden />
      </ToolbarButton>
      <ToolbarButton label={t('toolbar.link')} keys={[M, 'K']} active={s.link} onClick={onLink}>
        <Link2 aria-hidden />
      </ToolbarButton>
      <span className="lk-tb-sep" aria-hidden />

      <ToolbarButton
        label={t('toolbar.bulletList')}
        keys={[M, '⇧', '8']}
        active={s.bullet}
        onClick={() => run().toggleBulletList().run()}
      >
        <List aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.orderedList')}
        keys={[M, '⇧', '7']}
        active={s.ordered}
        onClick={() => run().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.taskList')}
        keys={[M, '⇧', '9']}
        active={s.task}
        onClick={() => run().toggleTaskList().run()}
      >
        <ListChecks aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.quote')}
        keys={[M, '⇧', 'B']}
        active={s.quote}
        onClick={() => run().toggleBlockquote().run()}
      >
        <Quote aria-hidden />
      </ToolbarButton>
      <span className="lk-tb-sep" aria-hidden />

      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="lk-tb"
            aria-label={t('toolbar.align')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <AlignIcon aria-hidden />
            <ChevronDown aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
          {ALIGNS.map(({ id, icon: Icon }) => (
            <DropdownItem key={id} onSelect={() => run().setTextAlign(id).run()}>
              <Icon />
              {t(`toolbar.align_${id}`)}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem onSelect={() => run().toggleSubscript().run()}>
            <Subscript />
            {t('toolbar.subscript')}
            {s.sub && <span className="ml-auto text-xs text-primary-ink">✓</span>}
          </DropdownItem>
          <DropdownItem onSelect={() => run().toggleSuperscript().run()}>
            <Superscript />
            {t('toolbar.superscript')}
            {s.sup && <span className="ml-auto text-xs text-primary-ink">✓</span>}
          </DropdownItem>
          <DropdownItem onSelect={() => run().unsetAllMarks().clearNodes().run()}>
            <Eraser />
            {t('toolbar.clearFormat')}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>

      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="lk-tb lk-tb-wide"
            aria-label={t('toolbar.insert')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Plus aria-hidden />
            {t('toolbar.insert')}
            <ChevronDown aria-hidden />
          </button>
        </DropdownTrigger>
        <DropdownContent
          align="start"
          className="max-h-[min(28rem,70vh)] overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {groups.map((g, gi) => (
            <div key={g}>
              {gi > 0 && <DropdownSeparator />}
              <DropdownLabel>{g}</DropdownLabel>
              {insertItems
                .filter((i) => i.group === g)
                .map((i) => (
                  <DropdownItem
                    key={i.id}
                    onSelect={() => i.run(editor, { from: caret, to: caret })}
                  >
                    <i.icon />
                    {i.title}
                  </DropdownItem>
                ))}
            </div>
          ))}
        </DropdownContent>
      </Dropdown>

      {s.inTable && (
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="lk-tb lk-tb-wide is-active"
              aria-label={t('table.menu')}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Table aria-hidden />
              {t('table.menu')}
              <ChevronDown aria-hidden />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownItem onSelect={() => run().addRowBefore().run()}>
              {t('table.rowBefore')}
            </DropdownItem>
            <DropdownItem onSelect={() => run().addRowAfter().run()}>
              {t('table.rowAfter')}
            </DropdownItem>
            <DropdownItem onSelect={() => run().addColumnBefore().run()}>
              {t('table.columnBefore')}
            </DropdownItem>
            <DropdownItem onSelect={() => run().addColumnAfter().run()}>
              {t('table.columnAfter')}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => run().toggleHeaderRow().run()}>
              {t('table.headerRow')}
            </DropdownItem>
            <DropdownItem onSelect={() => run().mergeOrSplit().run()}>
              {t('table.mergeSplit')}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => run().deleteRow().run()}>
              {t('table.deleteRow')}
            </DropdownItem>
            <DropdownItem onSelect={() => run().deleteColumn().run()}>
              {t('table.deleteColumn')}
            </DropdownItem>
            <DropdownItem danger onSelect={() => run().deleteTable().run()}>
              {t('table.delete')}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      )}
    </div>
  );
}
