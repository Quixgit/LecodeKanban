import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FileAttachmentView } from '../components/FileAttachmentView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attrs: { fileId: string; name: string; size: number }) => ReturnType;
    };
  }
}

export const fileUrl = (fileId: string) => `/api/v1/wiki/files/${fileId}/content`;

/** An uploaded file shown as a download chip. In Markdown it is a plain link. */
export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      fileId: { default: '' },
      name: { default: 'file' },
      size: { default: 0 },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-id]',
        getAttrs: (el) => ({
          fileId: (el as HTMLElement).getAttribute('data-file-id'),
          name: (el as HTMLElement).getAttribute('data-name'),
          size: Number((el as HTMLElement).getAttribute('data-size') ?? 0),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-file-id': node.attrs.fileId,
        'data-name': node.attrs.name,
        'data-size': node.attrs.size,
        class: 'lk-file',
      }),
      node.attrs.name,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView);
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },

  renderMarkdown(node) {
    return `[${String(node.attrs?.name ?? 'file')}](${fileUrl(String(node.attrs?.fileId ?? ''))})`;
  },
});
