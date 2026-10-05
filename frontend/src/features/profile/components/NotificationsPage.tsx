import {
  AtSign,
  CalendarClock,
  MessageSquare,
  MessagesSquare,
  MoveRight,
  Pencil,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { SettingsCard, Skeleton, Switch, toast } from '@/shared/ui';
import { useNotificationPrefs, useSetNotificationPref } from '../hooks/useProfile';

const ICONS: Record<string, LucideIcon> = {
  assigned: UserPlus,
  mention: AtSign,
  dm: MessageSquare,
  task_commented: MessagesSquare,
  task_moved: MoveRight,
  task_updated: Pencil,
  meeting: CalendarClock,
};

/** Which kinds of notification reach the bell. Everything is on until you switch it off. */
export function NotificationsPage() {
  const { t } = useTranslation('profile');
  const errorText = useErrorText();
  const prefs = useNotificationPrefs();
  const set = useSetNotificationPref();
  return (
    <SettingsCard title={t('notify.title')} description={t('notify.description')}>
      {prefs.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {prefs.data?.items.map((p) => {
            const Icon = ICONS[p.kind] ?? AtSign;
            return (
              <li key={p.kind} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary-ink [&_svg]:size-[18px] [&_svg]:stroke-[1.7]">
                  <Icon aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">
                    {t(`notify.kinds.${p.kind}.title`)}
                  </p>
                  <p className="text-sm text-text-muted">
                    {t(`notify.kinds.${p.kind}.description`)}
                  </p>
                </div>
                <Switch
                  checked={p.enabled}
                  aria-label={t(`notify.kinds.${p.kind}.title`)}
                  onCheckedChange={(enabled) =>
                    set.mutate(
                      { kind: p.kind, enabled },
                      { onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}
