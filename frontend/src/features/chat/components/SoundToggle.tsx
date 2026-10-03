import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSoundStore } from '@/features/notification-sounds';
import { IconButton, Tooltip } from '@/shared/ui';

/** One-click mute for notification sounds (the full settings live in the bell menu). */
export function SoundToggle() {
  const { t } = useTranslation('chat');
  const enabled = useSoundStore((s) => s.enabled);
  const setEnabled = useSoundStore((s) => s.setEnabled);
  const label = enabled ? t('sidebar.soundOff') : t('sidebar.soundOn');
  return (
    <Tooltip content={label}>
      <IconButton
        label={label}
        size="sm"
        variant="ghost"
        aria-pressed={enabled}
        onClick={() => setEnabled(!enabled)}
      >
        {enabled ? <Volume2 /> : <VolumeX />}
      </IconButton>
    </Tooltip>
  );
}
