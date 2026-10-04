import { Check, ImagePlus, Palette, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  COVER_PRESETS,
  COVER_PRESET_IDS,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@/shared/ui';
import { useProfileMutations } from '../hooks/useProfile';
import { checkPicture, coverJpeg } from '../model/avatar';

/** "Change background": pick a ready-made one or upload a picture. Sits in the corner of the profile header. */
export function CoverEditor({ user }: { user: User }) {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const { update, uploadCover, removeCover } = useProfileMutations();
  const input = useRef<HTMLInputElement>(null);
  const busy = update.isPending || uploadCover.isPending || removeCover.isPending;

  const take = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkPicture(file);
    if (problem) {
      toast.error(t(problem === 'type' ? 'avatar.badType' : 'avatar.tooBig'));
      return;
    }
    try {
      const strip = await coverJpeg(file);
      uploadCover.mutate(strip, {
        onSuccess: () => toast.success(t('cover.saved')),
        onError: (e) => toast.error(errorText(e)),
      });
    } catch {
      toast.error(t('avatar.unreadable'));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute right-3 top-3 bg-surface/90 backdrop-blur"
        >
          <Palette />
          {t('cover.change')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <p className="mb-2 text-sm font-medium text-text">{t('cover.presets')}</p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('cover.presets')}>
          {COVER_PRESET_IDS.map((id) => {
            const active = !user.coverUrl && user.coverPreset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`cover.names.${id}`)}
                disabled={busy}
                onClick={() => update.mutate({ coverPreset: id })}
                className={cn(
                  'relative h-10 rounded-lg bg-gradient-to-r outline-none ring-offset-2 ring-offset-surface transition-[transform,box-shadow] duration-micro hover:scale-105 focus-visible:shadow-focus',
                  COVER_PRESETS[id],
                  active && 'ring-2 ring-primary',
                )}
              >
                {active && (
                  <Check className="absolute inset-0 m-auto size-4 text-text" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={uploadCover.isPending}
            onClick={() => input.current?.click()}
          >
            <ImagePlus />
            {t('cover.upload')}
          </Button>
          {(user.coverUrl || user.coverPreset) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (user.coverUrl) removeCover.mutate();
                update.mutate({ coverPreset: '' });
              }}
            >
              <Trash2 />
              {t('cover.reset')}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-text-muted">{t('cover.hint')}</p>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          aria-label={t('cover.upload')}
          onChange={(e) => {
            void take(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
