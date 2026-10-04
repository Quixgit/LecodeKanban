import { Camera, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Avatar, Button, toast } from '@/shared/ui';
import { useProfileMutations } from '../hooks/useSettings';
import { ACCEPTED_TYPES, checkPicture, squarePng } from '../model/avatar';

/** The profile picture: pick, drop or paste a photo; it is cut to a square and shrunk before upload. */
export function AvatarEditor({ user }: { user: User }) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const { uploadAvatar, removeAvatar } = useProfileMutations();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = uploadAvatar.isPending || removeAvatar.isPending;

  const take = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkPicture(file);
    if (problem) {
      toast.error(t(problem === 'type' ? 'avatar.badType' : 'avatar.tooBig'));
      return;
    }
    try {
      const square = await squarePng(file);
      uploadAvatar.mutate(square, {
        onSuccess: () => toast.success(t('avatar.saved')),
        onError: (e) => toast.error(errorText(e)),
      });
    } catch {
      toast.error(t('avatar.unreadable'));
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex flex-wrap items-center gap-6 rounded-xl border border-dashed p-4 transition-colors duration-micro',
        over ? 'border-primary bg-primary-subtle' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={t('avatar.change')}
        className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="xl" className="size-24 text-2xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-overlay/45 text-white opacity-0 transition-opacity duration-micro group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-6" aria-hidden />
        </span>
        {busy && (
          <span
            role="status"
            aria-label={t('avatar.saving')}
            className="absolute inset-0 grid place-items-center rounded-full bg-surface/70"
          >
            <span className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{t('avatar.title')}</p>
        <p className="mt-0.5 text-xs text-text-muted">{t('avatar.hint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => input.current?.click()} loading={uploadAvatar.isPending}>
            <Upload />
            {user.avatarUrl ? t('avatar.change') : t('avatar.upload')}
          </Button>
          {user.avatarUrl && (
            <Button
              size="sm"
              variant="ghost"
              loading={removeAvatar.isPending}
              onClick={() =>
                removeAvatar.mutate(undefined, {
                  onSuccess: () => toast.success(t('avatar.removed')),
                  onError: (e) => toast.error(errorText(e)),
                })
              }
            >
              <Trash2 />
              {t('avatar.remove')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-label={t('avatar.upload')}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
