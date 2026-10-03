import { GitPullRequest } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { toast } from '@/shared/ui';
import type { GithubSummary } from '../api/githubApi';
import { useGithubMutations } from '../hooks/useGithub';
import type { Standing } from '../model/providers';
import { TileFrame } from './IntegrationTile';

/** GitHub's card: connected once per workspace by an administrator. */
export function GithubTile({
  summary,
  onSettings,
}: {
  summary: GithubSummary;
  onSettings: () => void;
}) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const m = useGithubMutations();
  const where: Standing = !summary.connected ? 'off' : summary.enabled ? 'active' : 'paused';
  return (
    <TileFrame
      t={{
        id: 'github',
        icon: GitPullRequest,
        name: t('github.name'),
        tagline: t('github.tagline'),
        where,
        account: summary.connected ? t('github.account', { login: summary.account }) : undefined,
        note: !summary.canManage ? t('github.adminOnly') : undefined,
        active: {
          checked: where === 'active',
          enabled: summary.connected && summary.canManage,
          label: t('active.aria', { name: t('github.name') }),
          onChange: (enabled) =>
            m.update.mutate({ enabled }, { onError: (e) => toast.error(errorText(e)) }),
        },
        action: {
          label: where === 'off' ? t('tile.connect') : t('tile.settings'),
          primary: where === 'off',
          icon: 'settings',
          onClick: onSettings,
        },
      }}
    />
  );
}
