import { CalendarClock, GitPullRequest, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { toast } from '@/shared/ui';
import type { IntegrationEntry, Provider } from '../api/integrationsApi';
import type { GithubSummary } from '../api/githubApi';
import { standing, type Standing } from '../model/providers';
import { useGithub, useGithubMutations } from './useGithub';
import { useIntegrationMutations, useIntegrations } from './useIntegrations';

export type ModuleId = Provider | 'github';

/** One connectable service as the grid and its own page see it. */
export interface ModuleView {
  id: ModuleId;
  to: string;
  icon: LucideIcon;
  name: string;
  tagline: string;
  where: Standing;
  /** The connected account, when there is one. */
  account?: string;
  note?: string;
  /** The Active switch: when it cannot be used it is shown off and disabled. */
  active: { checked: boolean; enabled: boolean; label: string; onChange: (on: boolean) => void };
  google?: IntegrationEntry;
  github?: GithubSummary;
}

/** Every module of the Integrations section with what it needs to draw a card or a header. */
export function useModules() {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const list = useIntegrations();
  const github = useGithub();
  const integ = useIntegrationMutations();
  const gh = useGithubMutations();
  const fail = (e: unknown) => toast.error(errorText(e));

  const modules: ModuleView[] = [];
  for (const entry of list.data?.items ?? []) {
    const where = standing(entry);
    const name = t(`${entry.provider}.name`);
    modules.push({
      id: entry.provider,
      to: `/integrations/${entry.provider}`,
      icon: CalendarClock,
      name,
      tagline: t(`${entry.provider}.tagline`),
      where,
      account:
        entry.connected && entry.accountEmail
          ? t('account', { email: entry.accountEmail })
          : undefined,
      active: {
        checked: where === 'active',
        enabled: where === 'active' || where === 'paused',
        label: t('active.aria', { name }),
        onChange: (enabled) =>
          integ.update.mutate({ provider: entry.provider, patch: { enabled } }, { onError: fail }),
      },
      google: entry,
    });
  }
  if (github.data) {
    const g = github.data;
    const where: Standing = !g.connected ? 'off' : g.enabled ? 'active' : 'paused';
    modules.push({
      id: 'github',
      to: '/integrations/github',
      icon: GitPullRequest,
      name: t('github.name'),
      tagline: t('github.tagline'),
      where,
      account: g.connected ? t('github.account', { login: g.account }) : undefined,
      note: !g.canManage ? t('github.adminOnly') : undefined,
      active: {
        checked: where === 'active',
        enabled: g.connected && g.canManage,
        label: t('active.aria', { name: t('github.name') }),
        onChange: (enabled) => gh.update.mutate({ enabled }, { onError: fail }),
      },
      github: g,
    });
  }
  return {
    modules,
    leadChoices: list.data?.leadChoices ?? [],
    isPending: list.isPending,
    isError: list.isError,
    error: list.error,
    refetch: () => void list.refetch(),
  };
}
