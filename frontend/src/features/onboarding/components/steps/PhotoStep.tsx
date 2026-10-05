import { motion, useReducedMotion } from 'framer-motion';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { checkPicture, squarePng, useProfileMutations } from '@/features/profile';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Avatar, Button, toast } from '@/shared/ui';
import { StepHead } from '../StepHead';

/** Pick or drop a picture: it is cut to a square, shrunk and uploaded straight away. */
export function PhotoStep({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const { t } = useTranslation('onboarding');
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const { uploadAvatar, removeAvatar } = useProfileMutations();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [just, setJust] = useState(false);
  const busy = uploadAvatar.isPending || removeAvatar.isPending;

  const take = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkPicture(file);
    if (problem) {
      toast.error(t(`photo.bad.${problem}`));
      return;
    }
    try {
      const square = await squarePng(file);
      uploadAvatar.mutate(square, {
        onSuccess: () => setJust(true),
        onError: (e) => toast.error(errorText(e)),
      });
    } catch {
      toast.error(t('photo.unreadable'));
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <StepHead icon={Camera} title={t('photo.title')} subtitle={t('photo.subtitle')} />
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        aria-label={t('photo.choose')}
        onChange={(e) => void take(e.target.files?.[0])}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-5 rounded-2xl border border-dashed p-8 transition-colors',
          over ? 'border-primary bg-primary-subtle' : 'border-border bg-surface-muted/50',
        )}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={avatarUrl ? t('photo.change') : t('photo.choose')}
          className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <motion.span
            aria-hidden
            className="absolute -inset-2 rounded-full"
            style={{
              background:
                'conic-gradient(from 0deg, rgb(var(--c-primary)), rgb(var(--c-review-bar)), rgb(var(--c-progress-bar)), rgb(var(--c-primary)))',
            }}
            animate={reduce ? undefined : { rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          <span className="absolute -inset-1 rounded-full bg-surface" aria-hidden />
          <motion.span
            key={avatarUrl ?? 'none'}
            className="relative block"
            initial={reduce ? false : { scale: 0.85, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={transition.spring}
          >
            <Avatar name={name || '?'} src={avatarUrl} size="xl" className="!size-28 !text-3xl" />
          </motion.span>
          <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-2 border-surface bg-primary-solid text-on-primary shadow-md transition-transform group-hover:scale-110">
            <ImagePlus className="size-4" aria-hidden />
          </span>
        </button>
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus />
              {avatarUrl ? t('photo.change') : t('photo.choose')}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  removeAvatar.mutate(undefined, {
                    onSuccess: () => setJust(false),
                    onError: (e) => toast.error(errorText(e)),
                  })
                }
              >
                <Trash2 />
                {t('photo.remove')}
              </Button>
            )}
          </div>
          <p role="status" className="mt-3 text-sm text-text-muted">
            {just && avatarUrl ? (
              <span className="font-medium text-done-ink">{t('photo.great')}</span>
            ) : avatarUrl ? (
              ''
            ) : (
              `${t('photo.drop')} · ${t('photo.initials')}`
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
