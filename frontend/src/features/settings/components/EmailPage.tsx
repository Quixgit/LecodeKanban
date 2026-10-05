import { CheckCircle2, Clock, Send, TriangleAlert, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { Button, EmptyState, Pill, SettingsCard, Skeleton, toast, type Tone } from '@/shared/ui';
import type { MailStatus } from '../api/settingsApi';
import { useMailStatus, useSendTestMail } from '../hooks/useSettings';
import { SectionHeader } from './SectionHeader';
import { SettingRow } from './SettingRow';

const STATUS: Record<MailStatus['recent'][number]['status'], { tone: Tone; icon: typeof Clock }> = {
  done: { tone: 'teal', icon: CheckCircle2 },
  failed: { tone: 'red', icon: XCircle },
  pending: { tone: 'amber', icon: Clock },
  running: { tone: 'amber', icon: Clock },
};

/** Is email really leaving the server? Shows the method, the queue, the latest emails and sends a test. */
export function EmailPage() {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const { language } = useLanguage();
  const { workspace } = useCurrentWorkspace();
  const canSee = workspace?.role === 'owner' || workspace?.role === 'admin';
  const mail = useMailStatus(workspace?.id, canSee);
  const test = useSendTestMail(workspace?.id ?? '');

  return (
    <div>
      <SectionHeader
        title={t('sections.email.title')}
        description={t('sections.email.description')}
        action={
          canSee && (
            <Button
              loading={test.isPending}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: () => toast.success(t('email.testQueued')),
                  onError: (e) => toast.error(errorText(e)),
                })
              }
            >
              <Send />
              {t('email.test')}
            </Button>
          )
        }
      />
      {!canSee ? (
        <EmptyState title={t('email.adminsOnly')} />
      ) : mail.isPending ? (
        <Skeleton className="h-64" />
      ) : mail.data ? (
        <div className="flex flex-col gap-6">
          {mail.data.capturing && (
            <p
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-progress/40 bg-progress-soft px-4 py-3 text-sm text-progress-ink"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">{t('email.capturingTitle')}</strong>
                <br />
                {t('email.capturingBody')}
              </span>
            </p>
          )}
          {mail.data.waiting > 3 && (
            <p className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-text-secondary">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('email.queueBody', { count: mail.data.waiting })}
            </p>
          )}
          <SettingsCard
            title={t('email.deliveryTitle')}
            description={t('email.deliveryDescription')}
          >
            <SettingRow title={t('email.method')}>
              <Pill tone="neutral">{mail.data.provider === 'mailgun' ? 'Mailgun' : 'SMTP'}</Pill>
            </SettingRow>
            <SettingRow
              title={mail.data.provider === 'mailgun' ? t('email.domain') : t('email.server')}
            >
              <code className="rounded bg-surface-muted px-2 py-1 text-sm text-text">
                {mail.data.host || '—'}
              </code>
            </SettingRow>
            <SettingRow title={t('email.from')}>
              <code className="rounded bg-surface-muted px-2 py-1 text-sm text-text">
                {mail.data.from}
              </code>
            </SettingRow>
            <SettingRow title={t('email.queue')} description={t('email.queueHint')}>
              <span className="flex gap-2">
                <Pill tone={mail.data.waiting > 0 ? 'amber' : 'neutral'}>
                  {t('email.waiting', { count: mail.data.waiting })}
                </Pill>
                <Pill tone={mail.data.failed > 0 ? 'red' : 'neutral'}>
                  {t('email.failed', { count: mail.data.failed })}
                </Pill>
              </span>
            </SettingRow>
          </SettingsCard>

          <SettingsCard title={t('email.recentTitle')} description={t('email.recentDescription')}>
            {mail.data.recent.length === 0 ? (
              <p className="text-sm text-text-muted">{t('email.none')}</p>
            ) : (
              <ul className="-my-4 divide-y divide-border-subtle">
                {mail.data.recent.map((m) => {
                  const s = STATUS[m.status];
                  const Icon = s.icon;
                  return (
                    <li key={m.id} className="flex items-start gap-3 py-3">
                      <Icon
                        className={`mt-0.5 size-4 shrink-0 ${m.status === 'failed' ? 'text-danger-ink' : m.status === 'done' ? 'text-done-ink' : 'text-progress-ink'}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{m.subject}</p>
                        <p className="truncate text-xs text-text-muted">
                          {m.recipient} · {formatRelative(m.at, language)}
                        </p>
                        {m.error && (
                          <p className="mt-1 break-words text-xs text-danger-ink">{m.error}</p>
                        )}
                      </div>
                      <Pill size="sm" tone={s.tone}>
                        {t(`email.status.${m.status}`)}
                      </Pill>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>

          <SettingsCard title={t('email.setupTitle')} description={t('email.setupDescription')}>
            <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs leading-relaxed text-text">{`# the containers read the LK_PROD_* host settings
LK_PROD_SMTP_HOST=smtp.your-provider.com
LK_PROD_SMTP_PORT=587
LK_PROD_SMTP_TLS=starttls
LK_SMTP_USERNAME=…
LK_SMTP_PASSWORD=…
LK_SMTP_FROM="LecodeKanban <no-reply@your-domain.com>"

# or, if the host blocks SMTP ports (Mailgun):
LK_MAIL_PROVIDER=mailgun
LK_MAILGUN_API_KEY=…
LK_MAILGUN_DOMAIN=mg.your-domain.com
LK_MAILGUN_FROM="LecodeKanban <no-reply@mg.your-domain.com>"`}</pre>
            <p className="mt-3 text-sm text-text-muted">{t('email.setupAfter')}</p>
          </SettingsCard>
        </div>
      ) : null}
    </div>
  );
}
