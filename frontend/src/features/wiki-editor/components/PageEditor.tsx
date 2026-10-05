import { copyText } from '@/shared/lib/clipboard';
import type { Editor } from '@tiptap/core';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpenText,
  Download,
  FileDown,
  FileUp,
  GripVertical,
  Keyboard,
  ListTree,
  MoreHorizontal,
  PanelTop,
  Pencil,
  Save,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { fade, transition } from '@/shared/motion';
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  IconButton,
  Skeleton,
  toast,
} from '@/shared/ui';
import { buildExtensions } from '../extensions';
import { fileUrl } from '../extensions/FileAttachment';
import { useAutosave } from '../hooks/useAutosave';
import { editorApi, type WikiContent } from '../lib/api';
import { looksLikeMarkdown } from '../lib/markdown';
import { startDownload, wikiExportUrl } from '@/shared/api';
import { isSafeLink, sanitizeDoc } from '../lib/sanitize';
import { filterSlash, slashItems } from '../lib/slashItems';
import '../styles/editor.css';
import { BubbleToolbar } from './BubbleToolbar';
import { useOutline } from '../hooks/useOutline';
import { OutlinePanel } from './OutlinePanel';
import { SaveStatus } from './SaveStatus';
import { ShortcutsDialog } from './ShortcutsDialog';
import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';
import { UrlDialog } from './UrlDialog';

export interface PageEditorProps {
  nodeId: string;
  /** Used for the downloaded file name. */
  title: string;
  /** Whether the caller may edit (the server enforces this too). */
  canEdit: boolean;
  fullWidth: boolean;
  onFullWidthChange?: (value: boolean) => void;
  /** Present for workspace admins: saves the page as a custom template. */
  onSaveAsTemplate?: () => void;
}

const contentKey = (nodeId: string) => ['wiki-content', nodeId] as const;

/** Loads a page's document, then hands it to the editor surface. */
export default function PageEditor(props: PageEditorProps) {
  const { t } = useTranslation('wikiEditor');
  const errorText = useErrorText();
  const content = useQuery({
    queryKey: contentKey(props.nodeId),
    queryFn: () => editorApi.content(props.nodeId),
    // The editor owns the document while it is open: never refetch underneath it.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (content.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-busy>
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (content.isError) {
    return (
      <EmptyState
        title={t('load.failed')}
        description={errorText(content.error)}
        action={
          <Button variant="secondary" onClick={() => content.refetch()}>
            {t('load.retry')}
          </Button>
        }
      />
    );
  }
  return <EditorSurface key={props.nodeId} {...props} initial={content.data} />;
}

function EditorSurface({
  nodeId,
  canEdit,
  fullWidth,
  onFullWidthChange,
  onSaveAsTemplate,
  initial,
}: PageEditorProps & { initial: WikiContent }) {
  const { t } = useTranslation('wikiEditor');
  const errorText = useErrorText();
  const [mode, setMode] = useState<'edit' | 'read'>('edit');
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [words, setWords] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickKind = useRef<'image' | 'file'>('image');
  const editorRef = useRef<Editor | null>(null);
  const editable = canEdit && mode === 'edit';

  const autosave = useAutosave({
    version: initial.version,
    save: async (doc, version) => {
      const saved = await editorApi.save(nodeId, sanitizeDoc(doc), version);
      return { version: saved.version };
    },
  });

  // Slash items are rebuilt with the current language; the editor reads them through a ref.
  const itemsRef = useRef<ReturnType<typeof slashItems>>([]);
  itemsRef.current = slashItems({
    t,
    pickFile: (kind) => {
      pickKind.current = kind;
      fileInput.current?.click();
    },
    askVideo: () => setVideoOpen(true),
  });

  const uploadAndInsert = useCallback(
    async (files: File[], at?: number) => {
      const editor = editorRef.current;
      if (!editor || files.length === 0) return;
      setUploading((n) => n + files.length);
      let pos = at ?? editor.state.selection.to;
      for (const file of files) {
        try {
          const f = await editorApi.upload(nodeId, file);
          const isImage = /^image\/(png|jpeg|gif|webp)$/.test(f.contentType);
          const content: JSONContent = isImage
            ? { type: 'image', attrs: { src: `${fileUrl(f.id)}?inline=true`, alt: f.name } }
            : { type: 'fileAttachment', attrs: { fileId: f.id, name: f.name, size: f.size } };
          editor.chain().focus().insertContentAt(pos, content).run();
          pos = editor.state.selection.to;
        } catch (e) {
          toast.error(t('upload.failed', { name: file.name }), errorText(e));
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [nodeId, t, errorText],
  );

  const editor = useEditor({
    extensions: useMemo(
      () =>
        buildExtensions({
          placeholder: (kind) =>
            kind === 'heading' ? t('placeholder.heading') : t('placeholder.block'),
          getSlashItems: (q) => filterSlash(itemsRef.current, q),
        }),
      // The language may change while editing; the placeholder text refreshes on remount, which
      // is acceptable, and slash labels already follow through the ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    ),
    content: initial.doc as JSONContent,
    editable,
    editorProps: {
      attributes: {
        class: 'lk-prose',
        'aria-label': t('editor.label'),
        role: 'textbox',
        'aria-multiline': 'true',
      },
      handleKeyDown: (_view, event) => {
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey &&
          event.key.toLowerCase() === 'k'
        ) {
          event.preventDefault();
          // The app-wide ⌘K palette listens on window; inside the editor ⌘K means "link".
          event.stopPropagation();
          setLinkOpen(true);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        if (!data) return false;
        const files = Array.from(data.files);
        if (files.length > 0) {
          event.preventDefault();
          void uploadAndInsert(files);
          return true;
        }
        const text = data.getData('text/plain');
        // Plain-text Markdown (no rich clipboard) becomes real blocks; everything else pastes as is.
        if (!data.getData('text/html') && looksLikeMarkdown(text)) {
          const ed = editorRef.current;
          if (!ed) return false;
          event.preventDefault();
          ed.chain()
            .focus()
            .insertContent(sanitizeDoc(ed.markdown!.parse(text)))
            .run();
          return true;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void uploadAndInsert(files, at);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      autosave.queue(e.getJSON());
      setWords(e.storage.characterCount.words());
    },
    onCreate: ({ editor: e }) => setWords(e.storage.characterCount.words()),
  });
  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const outline = useOutline(editor);

  // --- Markdown in and out
  const markdown = () => editor?.getMarkdown() ?? '';
  const copyMarkdown = async () => {
    try {
      if (!(await copyText(markdown()))) throw new Error('copy failed');
      toast.success(t('markdown.copied'));
    } catch {
      toast.error(t('markdown.copyFailed'));
    }
  };
  const importMarkdown = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    try {
      const text = await file.text();
      editor
        .chain()
        .focus('end')
        .insertContent(sanitizeDoc(editor.markdown!.parse(text)))
        .run();
      toast.success(t('markdown.imported', { name: file.name }));
    } catch {
      toast.error(t('markdown.importFailed'));
    }
  };

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadAndInsert(files);
  };

  // --- Conflict: somebody else saved a newer version
  const takeTheirs = async () => {
    try {
      const fresh = await editorApi.content(nodeId);
      editor?.commands.setContent(fresh.doc as JSONContent, { emitUpdate: false });
      autosave.reset(fresh.version);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const keepMine = async () => {
    if (!editor) return;
    try {
      const fresh = await editorApi.content(nodeId);
      autosave.reset(fresh.version);
      autosave.queue(editor.getJSON());
      void autosave.flush();
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  // --- Link dialog
  const linkHref = (editor?.getAttributes('link').href as string | undefined) ?? '';
  const applyLink = (value: string): string | null => {
    if (!editor) return null;
    if (!value) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return null;
    }
    const href = /^[a-z][a-z0-9+.-]*:|^[/#]/i.test(value) ? value : `https://${value}`;
    if (!isSafeLink(href)) return t('link.unsafe');
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive('link')) {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    return null;
  };
  const applyVideo = (value: string): string | null => {
    if (!editor) return null;
    if (!editor.commands.setYoutubeVideo({ src: value })) return t('video.invalid');
    return null;
  };

  const status = autosave.state;
  const showOutline = outlineOpen && !!editor && outline.length > 0;

  if (!editor) return null;

  return (
    <div className="lk-editor">
      <div className="lk-editor-bar">
        {editable ? (
          <Toolbar
            editor={editor}
            insertItems={itemsRef.current}
            onLink={() => setLinkOpen(true)}
          />
        ) : (
          <span className="lk-editor-readnote">
            {canEdit ? t('mode.readingNote') : t('mode.viewOnly')}
          </span>
        )}
        <div className="lk-editor-actions">
          {canEdit && <SaveStatus state={status} />}
          {uploading > 0 && (
            <span className="text-sm text-text-muted">
              {t('upload.uploading', { count: uploading })}
            </span>
          )}
          {canEdit && (
            <ToolbarButton
              label={mode === 'edit' ? t('mode.switchToRead') : t('mode.switchToEdit')}
              onClick={() => setMode(mode === 'edit' ? 'read' : 'edit')}
            >
              {mode === 'edit' ? <BookOpenText aria-hidden /> : <Pencil aria-hidden />}
            </ToolbarButton>
          )}
          <ToolbarButton
            label={t('outline.toggle')}
            active={showOutline}
            onClick={() => setOutlineOpen((o) => !o)}
          >
            <ListTree aria-hidden />
          </ToolbarButton>
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton label={t('toolbar.more')} variant="ghost" size="sm">
                <MoreHorizontal />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent onCloseAutoFocus={(e) => e.preventDefault()}>
              {onFullWidthChange && (
                <DropdownItem onSelect={() => onFullWidthChange(!fullWidth)}>
                  <PanelTop />
                  {fullWidth ? t('more.normalWidth') : t('more.fullWidth')}
                </DropdownItem>
              )}
              <DropdownItem onSelect={copyMarkdown}>
                <FileDown />
                {t('more.copyMarkdown')}
              </DropdownItem>
              <DropdownItem onSelect={() => startDownload(wikiExportUrl({ node: nodeId }, 'md'))}>
                <Download />
                {t('more.downloadMarkdown')}
              </DropdownItem>
              <DropdownItem onSelect={() => startDownload(wikiExportUrl({ node: nodeId }, 'html'))}>
                <Download />
                {t('more.downloadHtml')}
              </DropdownItem>
              {editable && (
                <DropdownItem
                  onSelect={() =>
                    setTimeout(() => document.getElementById(`md-import-${nodeId}`)?.click(), 0)
                  }
                >
                  <FileUp />
                  {t('more.importMarkdown')}
                </DropdownItem>
              )}
              {onSaveAsTemplate && (
                <>
                  <DropdownSeparator />
                  <DropdownItem onSelect={onSaveAsTemplate}>
                    <Save />
                    {t('more.saveTemplate')}
                  </DropdownItem>
                </>
              )}
              <DropdownSeparator />
              <DropdownItem onSelect={() => setShortcuts(true)}>
                <Keyboard />
                {t('more.shortcuts')}
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>

      {status === 'conflict' && (
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          role="alert"
          className="lk-editor-conflict"
        >
          <p>{t('conflict.message')}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={takeTheirs}>
              {t('conflict.loadTheirs')}
            </Button>
            <Button size="sm" onClick={keepMine}>
              {t('conflict.keepMine')}
            </Button>
          </div>
        </motion.div>
      )}
      {status === 'offline' && (
        <p role="status" className="lk-editor-offline">
          {t('status.offlineHint')}
        </p>
      )}

      <div className={cn('lk-editor-body', showOutline && 'has-outline')}>
        <div className="lk-editor-page">
          {editable && (
            <DragHandle editor={editor} nested>
              <span className="lk-draghandle" aria-label={t('toolbar.dragBlock')} role="img">
                <GripVertical aria-hidden />
              </span>
            </DragHandle>
          )}
          <EditorContent editor={editor} />
          {editable && <BubbleToolbar editor={editor} onLink={() => setLinkOpen(true)} />}
        </div>
        {showOutline && (
          <motion.aside
            className="lk-editor-side"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={transition.ui}
          >
            <OutlinePanel editor={editor} items={outline} />
          </motion.aside>
        )}
      </div>

      <footer className="lk-editor-foot">
        <span>{t('footer.words', { count: words })}</span>
        <button type="button" className="lk-foot-link" onClick={() => setShortcuts(true)}>
          <Keyboard aria-hidden />
          {t('more.shortcuts')}
        </button>
      </footer>

      <input
        ref={fileInput}
        type="file"
        hidden
        multiple
        accept={pickKind.current === 'image' ? 'image/*' : undefined}
        onChange={onPickFiles}
        aria-hidden
        tabIndex={-1}
      />
      <input
        id={`md-import-${nodeId}`}
        type="file"
        hidden
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        onChange={importMarkdown}
        aria-hidden
        tabIndex={-1}
      />

      <UrlDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title={t('link.title')}
        label={t('link.url')}
        placeholder="https://"
        initial={linkHref}
        onSubmit={applyLink}
        onRemove={linkHref ? () => applyLink('') : undefined}
      />
      <UrlDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title={t('video.title')}
        label={t('video.url')}
        placeholder="https://www.youtube.com/watch?v="
        onSubmit={applyVideo}
      />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </div>
  );
}
