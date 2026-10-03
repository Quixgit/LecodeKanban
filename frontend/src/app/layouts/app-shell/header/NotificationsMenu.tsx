import { Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SoundSettings } from '@/features/notification-sounds';
import { Dropdown, DropdownContent, DropdownTrigger, EmptyState, IconButton } from '@/shared/ui';

/** Bell with the notification inbox. Populated by the notifications module. */
export function NotificationsMenu({ unread = 0 }: { unread?: number }) {
  const { t } = useTranslation();
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton label={t('notifications.title')} dot={unread > 0}>
          <Bell />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent className="w-[340px] p-0">
        <div className="border-b border-border-subtle px-4 py-3">
          <p className="text-base font-semibold text-text">{t('notifications.title')}</p>
        </div>
        <EmptyState
          className="py-10"
          icon={<BellOff />}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyDescription')}
        />
        <SoundSettings />
      </DropdownContent>
    </Dropdown>
  );
}
