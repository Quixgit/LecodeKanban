import { ArrowRight, Check, Copy, ExternalLink, Link2, Unlink, Unplug } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllProjects } from '@/features/projects';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Field, PasswordInput, Select, Skeleton, Switch, toast } from '@/shared/ui';
import type { GithubRules, GithubSummary } from '../api/githubApi';
import { useGithubMutations, useGithubRepos } from '../hooks/useGithub';

const RULES: { key: keyof GithubRules; field: string }[] = [
  { key: 'prOpenedToReview', field: 'prOpenedToReview' },
  { key: 'prMergedToDone', field: 'prMergedToDone' },
  { key: 'syncIssues', field: 'syncIssues' },
  { key: 'commentOnPr', field: 'commentOnPr' },
];

function Steps() {
  const { t } = useTranslation('integrations');
  const steps = t('github.steps', { returnObjects: true }) as string[];
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-text-secondary">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function ConnectForm({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const m = useGithubMutations();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    m.connect.mutate(token.trim(), {
      onSuccess: () => {
        setToken('');
        toast.success(t('github.connected'));
      },
      onError: (err) => setError(errorText(err)),
    });
  };
  return (
    <div className="flex flex-col gap-6">
      <Steps />
      {canManage ? (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Field label={t('github.token')} hint={t('github.tokenHint')} error={error ?? undefined}>
            <PasswordInput
              showLabel={t('github.showToken')}
              hideLabel={t('github.hideToken')}
              value={token}
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_…"
              onChange={(e) => {
                setToken(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <div>
            <Button type="submit" loading={m.connect.isPending} disabled={token.trim().length < 20}>
              {t('github.connect')}
            </Button>
          </div>
        </form>
      ) : (
        <p role="note" className="rounded-lg bg-surface-muted p-3 text-sm text-text-secondary">
          {t('github.adminOnly')}
        </p>
      )}
    </div>
  );
}

/** Repositories linked to projects, and the form to link another. */
function Repos({ summary }: { summary: GithubSummary }) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const projects = useAllProjects(workspace?.id).data?.items ?? [];
  const available = useGithubRepos(summary.canManage && summary.enabled);
  const m = useGithubMutations();
  const [project, setProject] = useState('');
  const [repo, setRepo] = useState('');
  const fail = (e: unknown) => toast.error(errorText(e));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const linked = new Set(summary.repos.map((r) => r.projectId));
  const free = projects.filter((p) => !linked.has(p.id));

  return (
    <section aria-label={t('github.reposTitle')} className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text">{t('github.reposTitle')}</h3>
      {summary.repos.length === 0 ? (
        <p className="text-sm text-text-muted">{t('github.noRepos')}</p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
          {summary.repos.map((r) => {
            const p = byId.get(r.projectId);
            return (
              <li key={r.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-text">
                    <span className="truncate">
                      {p ? `${p.key} · ${p.name}` : t('github.project')}
                    </span>
                    <ArrowRight className="size-3.5 text-text-muted" aria-hidden />
                    <a
                      href={`https://github.com/${r.fullName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-ink hover:underline"
                    >
                      {r.fullName}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </p>
                </div>
                {summary.canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={m.unlink.isPending && m.unlink.variables === r.id}
                    onClick={() => m.unlink.mutate(r.id, { onError: fail })}
                    aria-label={t('github.unlink', { repo: r.fullName })}
                  >
                    <Unlink />
                    {t('github.unlinkShort')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {summary.canManage && summary.enabled && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-surface-muted p-3">
          <p className="text-xs font-medium text-text-secondary">{t('github.linkTitle')}</p>
          {available.isPending ? (
            <Skeleton className="h-9 rounded-lg" />
          ) : free.length === 0 ? (
            <p className="text-xs text-text-muted">{t('github.allLinked')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                label={t('github.project')}
                value={project}
                placeholder={t('github.chooseProject')}
                onValueChange={setProject}
                options={free.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
              />
              <ArrowRight className="size-4 text-text-muted" aria-hidden />
              <Select
                label={t('github.repo')}
                value={repo}
                placeholder={t('github.chooseRepo')}
                onValueChange={setRepo}
                options={(available.data?.items ?? []).map((r) => ({ value: r, label: r }))}
              />
              <Button
                size="sm"
                disabled={!project || !repo}
                loading={m.link.isPending}
                onClick={() =>
                  m.link.mutate(
                    { projectId: project, repo },
                    {
                      onSuccess: () => {
                        setProject('');
                        setRepo('');
                        toast.success(t('github.linked'));
                      },
                      onError: fail,
                    },
                  )
                }
              >
                <Link2 />
                {t('github.link')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function WebhookRow({ url }: { url: string }) {
  const { t } = useTranslation('integrations');
  const [done, setDone] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{t('github.webhook')}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface-muted py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-xs text-text">
          {url}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setDone(true);
              window.setTimeout(() => setDone(false), 1800);
            });
          }}
        >
          {done ? <Check /> : <Copy />}
          {done ? t('setup.copied') : t('setup.copy')}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{t('github.webhookHint')}</p>
    </div>
  );
}

/** GitHub's settings panel: connect with a token, or (connected) repositories, rules and disconnecting. */
export function GithubSettings({ summary }: { summary: GithubSummary }) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const m = useGithubMutations();
  const [confirm, setConfirm] = useState(false);
  const fail = (e: unknown) => toast.error(errorText(e));

  if (!summary.connected) return <ConnectForm canManage={summary.canManage} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg bg-surface-muted px-4 py-3">
        <p className="text-sm font-medium text-text">
          {t('github.account', { login: summary.account })}
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border-subtle px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-text">{t('active.label')}</span>
          <span className="block text-xs text-text-muted">{t('github.activeHint')}</span>
        </span>
        <Switch
          checked={summary.enabled}
          disabled={!summary.canManage}
          onCheckedChange={(enabled) => m.update.mutate({ enabled }, { onError: fail })}
          aria-label={t('github.activeAria')}
        />
      </label>

      <Repos summary={summary} />

      <section aria-label={t('github.rulesTitle')} className="divide-y divide-border-subtle">
        <h3 className="pb-2 text-sm font-semibold text-text">{t('github.rulesTitle')}</h3>
        {RULES.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-start justify-between gap-4 py-3">
            <span className="min-w-0 max-w-sm">
              <span className="block text-sm font-medium text-text">
                {t(`github.rules.${r.field}`)}
              </span>
              <span className="mt-0.5 block text-xs text-text-muted">
                {t(`github.rules.${r.field}Hint`)}
              </span>
            </span>
            <Switch
              checked={summary.rules[r.key]}
              disabled={!summary.canManage || !summary.enabled}
              onCheckedChange={(on) => m.update.mutate({ [r.key]: on }, { onError: fail })}
              aria-label={t(`github.rules.${r.field}`)}
            />
          </label>
        ))}
      </section>

      <WebhookRow url={summary.webhookUrl} />

      <p className="rounded-lg bg-surface-muted p-3 text-xs text-text-muted">
        {t('github.howItWorks')}
      </p>

      {summary.canManage && (
        <div className="border-t border-border-subtle pt-4">
          {!confirm ? (
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <Unplug />
                {t('disconnect')}
              </Button>
            </div>
          ) : (
            <div
              role="group"
              aria-label={t('github.disconnectTitle')}
              className="rounded-lg border border-danger/30 bg-danger-soft p-4"
            >
              <p className="text-sm font-medium text-danger-ink">{t('github.disconnectTitle')}</p>
              <p className="mt-1 text-xs text-danger-ink">{t('github.disconnectBody')}</p>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={m.disconnect.isPending}
                  onClick={() =>
                    m.disconnect.mutate(undefined, {
                      onSuccess: () => setConfirm(false),
                      onError: fail,
                    })
                  }
                >
                  {t('disconnectConfirm')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
