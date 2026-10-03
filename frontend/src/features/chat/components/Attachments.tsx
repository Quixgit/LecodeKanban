import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Modal, Tooltip } from '@/shared/ui';
import type { ChatFile } from '../api/chatApi';
import { formatBytes, iconFor, isImage } from '../model/files';

/** Files on a message: images show inline and open large, everything else is a download card. */
export function Attachments({ files }: { files: readonly ChatFile[] }) {
  const { t } = useTranslation('chat');
  const [open, setOpen] = useState<ChatFile | null>(null);
  if (files.length === 0) return null;
  const images = files.filter(isImage);
  const others = files.filter((f) => !isImage(f));
  return (
    <div className="mt-1.5 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setOpen(f)}
              aria-label={t('files.open', { name: f.name })}
              className="overflow-hidden rounded-xl border border-border bg-surface-muted outline-none transition-shadow duration-micro hover:shadow-md focus-visible:shadow-focus"
            >
              <img
                src={`${f.url}?inline=true`}
                alt={f.name}
                loading="lazy"
                className="max-h-60 max-w-full object-contain sm:max-w-sm"
              />
            </button>
          ))}
        </div>
      )}
      {others.map((f) => (
        <FileCard key={f.id} file={f} />
      ))}
      <Modal
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        size="lg"
        title={open?.name ?? ''}
        description={open ? formatBytes(open.size) : undefined}
      >
        {open && (
          <div className="flex flex-col items-center gap-3">
            <img
              src={`${open.url}?inline=true`}
              alt={open.name}
              className="max-h-[70vh] max-w-full rounded-lg object-contain"
            />
            <a
              href={open.url}
              download={open.name}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-ink hover:underline focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Download className="size-4" aria-hidden />
              {t('files.download')}
            </a>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function FileCard({ file }: { file: ChatFile }) {
  const { t } = useTranslation('chat');
  const Icon = iconFor(file);
  return (
    <div className="flex max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-xs">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink [&_svg]:size-5 [&_svg]:stroke-[1.6]">
        <Icon aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-text">{file.name}</p>
        <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
      </div>
      <Tooltip content={t('files.download')}>
        <IconButton
          label={t('files.downloadNamed', { name: file.name })}
          variant="ghost"
          size="sm"
          asChild
        >
          <a href={file.url} download={file.name}>
            <Download />
          </a>
        </IconButton>
      </Tooltip>
    </div>
  );
}
