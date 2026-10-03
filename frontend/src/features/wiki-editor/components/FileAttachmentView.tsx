import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Paperclip } from 'lucide-react';
import { fileUrl } from '../extensions/FileAttachment';

const KB = 1024;
function size(bytes: number) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / KB / KB).toFixed(1)} MB`;
}

export function FileAttachmentView({ node }: NodeViewProps) {
  const {
    fileId,
    name,
    size: bytes,
  } = node.attrs as { fileId: string; name: string; size: number };
  return (
    <NodeViewWrapper className="lk-file" data-drag-handle>
      <a href={fileUrl(fileId)} download={name} contentEditable={false}>
        <Paperclip aria-hidden />
        <span className="lk-file-name">{name}</span>
        <span className="lk-file-size">{size(bytes)}</span>
      </a>
    </NodeViewWrapper>
  );
}
