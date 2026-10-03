import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Avatar, Tooltip, type AvatarSize } from '@/shared/ui';
import type { ChatStatus } from '../api/chatApi';
import { STATUS_ICONS, presenceOf, type Presence } from '../model/status';

const DOT: Record<Exclude<Presence, 'offline'>, string> = {
  online: 'bg-available',
  busy: 'bg-progress',
  dnd: 'bg-danger',
  away: 'border-[1.5px] border-border-strong bg-surface',
};

/** An avatar with a dot: green online, amber busy, red do-not-disturb, hollow away. */
export function PersonAvatar({
  name,
  src,
  online,
  status,
  size = 'sm',
}: {
  name: string;
  src?: string | null;
  online?: boolean;
  status?: ChatStatus;
  size?: AvatarSize;
}) {
  const { t } = useTranslation('chat');
  const presence = presenceOf(!!online, status);
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} src={src} size={size} />
      {presence !== 'offline' && (
        <span
          role="img"
          aria-label={t(`status.kinds.${presence}`)}
          className={cn(
            'absolute -bottom-px -right-px grid place-items-center rounded-full ring-[1.5px] ring-surface',
            size === 'lg' || size === 'xl' ? 'size-2.5' : 'size-2',
            DOT[presence],
          )}
        >
          {presence === 'dnd' && <span className="h-px w-1 bg-white" aria-hidden />}
        </span>
      )}
    </span>
  );
}

/** The custom status icon next to a name; its text is in the tooltip. Nothing when there is none. */
export function StatusBadge({ status, className }: { status?: ChatStatus; className?: string }) {
  const { t } = useTranslation('chat');
  if (!status || (!status.icon && !status.text)) return null;
  const Icon = status.icon ? STATUS_ICONS[status.icon] : null;
  const label = status.text || t(`status.kinds.${status.kind}`);
  return (
    <Tooltip content={label}>
      <span
        role="img"
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 [&_svg]:size-3.5 [&_svg]:stroke-[1.8]',
          status.kind === 'available' ? 'text-available' : 'text-text-muted',
          className,
        )}
      >
        {Icon ? <Icon aria-hidden /> : <span className="size-1.5 rounded-full bg-text-faint" />}
      </span>
    </Tooltip>
  );
}
