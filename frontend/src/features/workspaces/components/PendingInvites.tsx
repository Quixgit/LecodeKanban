import { AnimatePresence, motion } from 'framer-motion';
import { MailOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Invite, Workspace } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import { transition } from '@/shared/motion';
import { Button, EmptyState, toast } from '@/shared/ui';
import { useWorkspaceMutations } from '../hooks/useWorkspaces';
import { RolePill } from './RolePill';

export function PendingInvites({
  workspace,
  invites,
}: {
  workspace: Workspace;
  invites: Invite[];
}) {
  const { t } = useTranslation('team');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { revoke } = useWorkspaceMutations(workspace.id);

  if (invites.length === 0)
    return <EmptyState className="py-8" icon={<MailOpen />} title={t('pending.empty')} />;

  return (
    <ul className="divide-y divide-border-subtle">
      <AnimatePresence initial={false}>
        {invites.map((inv) => (
          <motion.li
            key={inv.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition.ui}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
                <MailOpen className="size-4 stroke-[1.75]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-text">{inv.email}</p>
                <p className="text-xs text-text-muted">
                  {t('pending.expires', { date: formatDate(inv.expiresAt, language) })}
                </p>
              </div>
              <RolePill role={inv.role} />
              <Button
                variant="ghost"
                size="sm"
                loading={revoke.isPending && revoke.variables === inv.id}
                onClick={() =>
                  revoke.mutate(inv.id, {
                    onSuccess: () => toast.info(t('pending.revoked')),
                    onError: (e) => toast.error(errorText(e)),
                  })
                }
              >
                {t('pending.revoke')}
              </Button>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
