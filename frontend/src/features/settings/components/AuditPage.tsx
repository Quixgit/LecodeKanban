import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useLanguage } from '@/shared/i18n';
import { formatDate, formatRelative } from '@/shared/lib/format';
import { Avatar, EmptyState, Skeleton } from '@/shared/ui';
import type { AuditEntry } from '../api/settingsApi';
import { useAudit } from '../hooks/useSettings';
import { SectionHeader } from './SectionHeader';

/** What the administrators changed, newest first. */
export function AuditPage() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const { workspace } = useCurrentWorkspace();
  const canSee = workspace?.role === 'owner' || workspace?.role === 'admin';
  const audit = useAudit(workspace?.id, canSee);

  return (
    <div>
      <SectionHeader
        title={t('sections.audit.title')}
        description={t('sections.audit.description')}
      />
      {!canSee ? (
        <EmptyState icon={<History />} title={t('audit.adminsOnly')} />
      ) : audit.isPending ? (
        <Skeleton className="h-48" />
      ) : !audit.data?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface">
          <EmptyState
            icon={<History />}
            title={t('audit.empty')}
            description={t('audit.emptyHint')}
          />
        </div>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card">
          {audit.data.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 border-b border-border-subtle px-5 py-4 last:border-b-0"
            >
              <Avatar name={e.actor?.name ?? '?'} src={e.actor?.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">
                  <span className="font-medium">{e.actor?.name ?? t('audit.someone')}</span>{' '}
                  {describe(e, t)}
                </p>
                <time
                  dateTime={e.at}
                  title={formatDate(e.at, language)}
                  className="text-xs text-text-muted"
                >
                  {formatRelative(e.at, language)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function describe(e: AuditEntry, t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = e.details as Record<string, unknown>;
  switch (e.action) {
    case 'settings.updated': {
      const changed = Array.isArray(d.changed) ? (d.changed as string[]) : [];
      return t('audit.settings.updated', {
        what: changed.map((c) => t(`audit.keys.${c}`, { defaultValue: c })).join(', '),
      });
    }
    case 'workspace.renamed':
      return t('audit.workspace.renamed', { name: String(d.name ?? '') });
    case 'member.role_changed':
      return t('audit.member.role_changed', {
        from: t(`roles.${String(d.from)}`),
        to: t(`roles.${String(d.to)}`),
      });
    case 'member.removed':
      return d.self ? t('audit.member.left') : t('audit.member.removed');
    case 'invite.sent':
      return t('audit.invite.sent', {
        email: String(d.email ?? ''),
        role: t(`roles.${String(d.role)}`),
      });
    case 'invite.revoked':
      return t('audit.invite.revoked');
    default:
      return e.action;
  }
}
