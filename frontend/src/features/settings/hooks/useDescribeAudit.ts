import { useTranslation } from 'react-i18next';
import type { AuditEntry } from '../api/settingsApi';

/** One audit entry as a sentence (the person who did it is shown next to it). */
function sentence(e: AuditEntry, t: (k: string, o?: Record<string, unknown>) => string): string {
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
        from: t(`roles.names.${String(d.from)}`),
        to: t(`roles.names.${String(d.to)}`),
      });
    case 'member.removed':
      return d.self ? t('audit.member.left') : t('audit.member.removed');
    case 'invite.sent':
      return t('audit.invite.sent', {
        email: String(d.email ?? ''),
        role: t(`roles.names.${String(d.role)}`),
      });
    case 'invite.revoked':
      return t('audit.invite.revoked');
    default:
      return e.action;
  }
}

/** Returns a function that turns an audit entry into a sentence in the current language. */
export function useDescribeAudit() {
  const { t } = useTranslation('settings');
  return (e: AuditEntry) => sentence(e, t);
}
