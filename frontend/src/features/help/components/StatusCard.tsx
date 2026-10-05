import { CircleAlert, CircleCheck, Mail, ServerCog, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMailStatus } from '@/features/settings';
import { useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { Avatar, Card, CardHeader, CardTitle } from '@/shared/ui';

/** Is the platform healthy, which build is this, and who to ask. Email health is shown to administrators only. */
export function StatusCard() {
  const { t } = useTranslation('help');
  const { workspace } = useCurrentWorkspace();
  const isAdmin = workspace?.role === 'owner' || workspace?.role === 'admin';
  const mail = useMailStatus(workspace?.id, isAdmin);
  const members = useWorkspaceMembers(workspace?.id);
  const owner = members.data?.find((m) => m.role === 'owner')?.user;
  const m = mail.data;
  const problem = m && (m.failed > 0 || m.capturing);

  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>{t('status.title')}</CardTitle>
      </CardHeader>
      <ul className="flex flex-col gap-3 text-sm">
        <li className="flex items-center gap-3">
          <ServerCog className="size-4 text-text-muted" aria-hidden />
          <span className="text-text-secondary">
            {t('status.version', { version: __APP_VERSION__ })}
          </span>
        </li>
        {m && (
          <li className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 text-text-muted" aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-text">
                {problem ? (
                  <CircleAlert className="text-warning size-4" aria-hidden />
                ) : (
                  <CircleCheck className="size-4 text-done" aria-hidden />
                )}
                {t('status.mail')}:{' '}
                {m.capturing
                  ? t('status.mailCapturing')
                  : problem
                    ? t('status.mailFailed', { count: m.failed })
                    : t('status.mailOk')}
              </span>
              {m.waiting > 0 && (
                <span className="text-xs text-text-muted">
                  {t('status.mailWaiting', { count: m.waiting })}
                </span>
              )}
            </span>
          </li>
        )}
        {owner && (
          <li className="flex items-center gap-3">
            <UserRound className="size-4 text-text-muted" aria-hidden />
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
              <span className="min-w-0">
                <span className="block truncate text-text">{owner.name}</span>
                <span className="block truncate text-xs text-text-muted">
                  {t('status.contactHint')}
                </span>
              </span>
            </span>
            <a
              href={`mailto:${owner.email}`}
              className="shrink-0 rounded-md px-2 py-1 text-primary-ink hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t('status.ask')}
            </a>
          </li>
        )}
      </ul>
    </Card>
  );
}
