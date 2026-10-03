import {
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { ChatFile } from '../api/chatApi';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const isImage = (f: Pick<ChatFile, 'contentType'>) => IMAGE_TYPES.has(f.contentType);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function iconFor(f: Pick<ChatFile, 'name' | 'contentType'>): LucideIcon {
  const t = f.contentType;
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  if (t.startsWith('audio/')) return FileAudio;
  if (t.startsWith('video/')) return FileVideo;
  if (['zip', 'gz', 'tgz', 'tar', '7z', 'rar'].includes(ext) || t.includes('zip'))
    return FileArchive;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return FileSpreadsheet;
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return Presentation;
  if (
    t.startsWith('text/') ||
    t === 'application/pdf' ||
    ['doc', 'docx', 'md', 'txt', 'pdf'].includes(ext)
  )
    return FileText;
  return FileIcon;
}
