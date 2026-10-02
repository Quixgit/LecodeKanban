import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  File,
  FileArchive,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Paperclip,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatNumber, formatRelative } from '@/shared/lib/format';
import { fadeUp } from '@/shared/motion';
import { Button, IconButton, toast } from '@/shared/ui';
import { attachmentUrl, type Attachment } from '../api/drawerApi';
import { useAttachments } from '../hooks/useDrawerData';

function size(bytes: number, lang: string) {
  if (bytes < 1024) return `${formatNumber(bytes, lang)} B`;
  if (bytes < 1024 ** 2)
    return `${formatNumber(bytes / 1024, lang, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(bytes / 1024 ** 2, lang, { maximumFractionDigits: 1 })} MB`;
}

function iconFor(a: Attachment): LucideIcon {
  const type = a.contentType;
  const ext = a.name.split('.').pop()?.toLowerCase() ?? '';
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (/sheet|excel|csv/.test(type) || ['xls', 'xlsx', 'csv', 'ods'].includes(ext))
    return FileSpreadsheet;
  if (/zip|compressed|tar|rar|7z/.test(type) || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return FileArchive;
  if (
    type.startsWith('text/') ||
    /pdf|word|document|presentation/.test(type) ||
    ['pdf', 'doc', 'docx', 'odt', 'ppt', 'pptx', 'txt', 'md', 'rtf'].includes(ext)
  )
    return FileText;
  return File;
}

function Thumb({ a }: { a: Attachment }) {
  const [failed, setFailed] = useState(false);
  const Icon = iconFor(a);
  if (a.previewable && !failed) {
    return (
      <a
        href={attachmentUrl(a.id, true)}
        target="_blank"
        rel="noreferrer"
        tabIndex={-1}
        aria-hidden
        className="size-12 shrink-0 overflow-hidden rounded-md bg-surface-muted"
      >
        <img
          src={attachmentUrl(a.id, true)}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      </a>
    );
  }
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-muted">
      <Icon className="size-6" aria-hidden />
    </span>
  );
}

/** Files on a card: drop or pick to upload; images get a thumbnail. */
export function Attachments({
  cardId,
  workspaceId,
  editable,
  canDelete,
}: {
  cardId: string;
  workspaceId: string;
  editable: boolean;
  canDelete: (a: Attachment) => boolean;
}) {
  const { t } = useTranslation('card');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { list, upload, remove } = useAttachments(cardId, workspaceId);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const send = (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      upload.mutate(f, {
        onSuccess: (a) => toast.success(t('attachments.uploaded', { name: a.name })),
        onError: (e) => toast.error(`${f.name}: ${errorText(e)}`),
      });
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (editable) send(e.dataTransfer.files);
  };

  const items = list.data ?? [];
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg transition-colors',
        over && 'ring-dashed bg-primary-subtle ring-2 ring-primary/40',
      )}
      onDragOver={(e) => {
        if (!editable || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <ul className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((a) => (
            <motion.li
              key={a.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="group/att flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-2"
            >
              <Thumb a={a} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{a.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {size(a.size, language)} · {a.uploadedBy?.name ?? t('someone')} ·{' '}
                  {formatRelative(a.createdAt, language)}
                </p>
              </div>
              <IconButton
                asChild
                variant="ghost"
                size="sm"
                label={t('attachments.download', { name: a.name })}
              >
                <a href={attachmentUrl(a.id)} download={a.name}>
                  <Download />
                </a>
              </IconButton>
              {canDelete(a) && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  label={t('attachments.delete', { name: a.name })}
                  onClick={() => remove.mutate(a.id, { onError: (e) => toast.error(errorText(e)) })}
                >
                  <Trash2 />
                </IconButton>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {items.length === 0 && !editable && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Paperclip className="size-4" aria-hidden />
          {t('attachments.none')}
        </p>
      )}
      {editable && (
        <>
          <input ref={input} type="file" multiple hidden onChange={(e) => send(e.target.files)} />
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            loading={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <Upload />
            {t('attachments.add')}
          </Button>
          <p className="text-2xs text-text-faint">{t('attachments.hint')}</p>
        </>
      )}
    </div>
  );
}
