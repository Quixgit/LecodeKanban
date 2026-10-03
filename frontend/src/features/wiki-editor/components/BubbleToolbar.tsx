import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Highlighter, Italic, Link2, Strikethrough, Underline } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { modKeyLabel } from '@/shared/lib/platform';
import { ToolbarButton } from './ToolbarButton';

/** The floating bar above a text selection. */
export function BubbleToolbar({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const { t } = useTranslation('wikiEditor');
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
    }),
  });
  const run = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: e, state }) =>
        e.isEditable && !state.selection.empty && !e.isActive('codeBlock') && !e.isActive('image')
      }
      className="lk-bubble"
      role="toolbar"
      aria-label={t('bubble.label')}
    >
      <ToolbarButton
        label={t('toolbar.bold')}
        keys={[modKeyLabel, 'B']}
        active={s.bold}
        onClick={() => run().toggleBold().run()}
      >
        <Bold aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.italic')}
        keys={[modKeyLabel, 'I']}
        active={s.italic}
        onClick={() => run().toggleItalic().run()}
      >
        <Italic aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.underline')}
        keys={[modKeyLabel, 'U']}
        active={s.underline}
        onClick={() => run().toggleUnderline().run()}
      >
        <Underline aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.strike')}
        keys={[modKeyLabel, '⇧', 'S']}
        active={s.strike}
        onClick={() => run().toggleStrike().run()}
      >
        <Strikethrough aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.code')}
        keys={[modKeyLabel, 'E']}
        active={s.code}
        onClick={() => run().toggleCode().run()}
      >
        <Code aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label={t('toolbar.highlight')}
        keys={[modKeyLabel, '⇧', 'H']}
        active={s.highlight}
        onClick={() => run().toggleHighlight().run()}
      >
        <Highlighter aria-hidden />
      </ToolbarButton>
      <span className="lk-tb-sep" aria-hidden />
      <ToolbarButton
        label={t('toolbar.link')}
        keys={[modKeyLabel, 'K']}
        active={s.link}
        onClick={onLink}
      >
        <Link2 aria-hidden />
      </ToolbarButton>
    </BubbleMenu>
  );
}
