import { Bell, ClipboardPlus, MessageSquare, Play, AtSign, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton, Switch, Tooltip } from '@/shared/ui';
import { playSound, type SoundKind } from '../model/synth';
import { useSoundStore } from '../store/soundStore';

const ROWS: { kind: SoundKind; icon: typeof Bell }[] = [
  { kind: 'message', icon: MessageSquare },
  { kind: 'mention', icon: AtSign },
  { kind: 'task', icon: ClipboardPlus },
  { kind: 'notify', icon: Bell },
];

/** Master switch, volume and per-kind switches with a preview button, for the notifications menu. */
export function SoundSettings() {
  const { t } = useTranslation();
  const s = useSoundStore();
  return (
    <div className="border-t border-border-subtle px-4 py-3" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-text">
          {s.enabled ? (
            <Volume2 className="size-4 text-text-muted" aria-hidden />
          ) : (
            <VolumeX className="size-4 text-text-muted" aria-hidden />
          )}
          {t('notifications.sound.title')}
        </span>
        <Switch
          checked={s.enabled}
          onCheckedChange={s.setEnabled}
          aria-label={t('notifications.sound.title')}
        />
      </div>
      {s.enabled && (
        <div className="mt-3 space-y-2.5">
          <label className="flex items-center gap-3 text-xs text-text-muted">
            <span className="w-14 shrink-0">{t('notifications.sound.volume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              onChange={(e) => s.setVolume(Number(e.target.value) / 100)}
              onPointerUp={() => playSound('notify', s.volume)}
              aria-label={t('notifications.sound.volume')}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />
          </label>
          <ul className="space-y-1">
            {ROWS.map(({ kind, icon: Icon }) => (
              <li key={kind} className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
                <span className="flex-1 text-sm text-text">
                  {t(`notifications.sound.kinds.${kind}`)}
                </span>
                <Tooltip content={t('notifications.sound.preview')}>
                  <IconButton
                    label={t('notifications.sound.previewNamed', {
                      name: t(`notifications.sound.kinds.${kind}`),
                    })}
                    variant="ghost"
                    size="sm"
                    onClick={() => playSound(kind, s.volume)}
                  >
                    <Play />
                  </IconButton>
                </Tooltip>
                <Switch
                  checked={s.kinds[kind]}
                  onCheckedChange={(v) => s.setKind(kind, v)}
                  aria-label={t(`notifications.sound.kinds.${kind}`)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
