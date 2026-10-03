import { useTranslation } from 'react-i18next';
import { Avatar, type AvatarSize } from '@/shared/ui';

/** An avatar with a small green dot when the person is online. */
export function PersonAvatar({
  name,
  src,
  online,
  size = 'sm',
}: {
  name: string;
  src?: string | null;
  online?: boolean;
  size?: AvatarSize;
}) {
  const { t } = useTranslation('chat');
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} src={src} size={size} />
      {online && (
        <span
          role="img"
          aria-label={t('presence.online')}
          className="bg-success absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface"
        />
      )}
    </span>
  );
}
