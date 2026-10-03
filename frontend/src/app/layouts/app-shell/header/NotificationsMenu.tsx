import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationList, useNotifications } from '@/features/notifications';
import { SoundSettings } from '@/features/notification-sounds';
import { IconButton, Popover, PopoverContent, PopoverTrigger } from '@/shared/ui';

/** Bell with the notification inbox: a red count while something is unread. */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { unread } = useNotifications();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          label={
            unread > 0
              ? t('notifications.titleUnread', { count: unread })
              : t('notifications.title')
          }
          count={unread}
        >
          <Bell />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-1.5rem)] p-0">
        <NotificationList onNavigate={() => setOpen(false)} />
        <SoundSettings />
      </PopoverContent>
    </Popover>
  );
}
