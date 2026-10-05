import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useLanguage } from '@/shared/i18n';
import { formatDate, formatRelative } from '@/shared/lib/format';
import { Avatar, EmptyState, Skeleton } from '@/shared/ui';
import { useAudit } from '../hooks/useSettings';
import { useDescribeAudit } from '../hooks/useDescribeAudit';
import { SectionHeader } from './SectionHeader';

/** What the administrators changed, newest first. */
export function AuditPage() {
  const { t } = useTranslation('settings');
  const describe = useDescribeAudit();
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
                  {describe(e)}
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
