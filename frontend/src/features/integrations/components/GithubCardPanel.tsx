import { copyText } from '@/shared/lib/clipboard';
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  CircleDot,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Pill, toast } from '@/shared/ui';
import type { GithubLink } from '../api/githubApi';
import { useCardGithub, useCreateIssue } from '../hooks/useGithub';

const TONE: Record<GithubLink['state'], 'teal' | 'neutral' | 'purple' | 'red'> = {
  open: 'teal',
  draft: 'neutral',
  merged: 'purple',
  closed: 'red',
};

function LinkRow({ l }: { l: GithubLink }) {
  const { t } = useTranslation('integrations');
  const Icon = l.kind === 'pr' ? (l.state === 'merged' ? GitMerge : GitPullRequest) : CircleDot;
  return (
    <li>
      <a
        href={l.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:bg-surface-muted"
      >
        <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">
            <span className="mr-1.5 font-mono text-xs text-text-muted">#{l.number}</span>
            {l.title}
          </span>
          <span className="block truncate text-xs text-text-muted">
            {l.repo}
            {l.author && ` · ${l.author}`}
          </span>
        </span>
        <Pill tone={TONE[l.state]} size="sm">
          {t(`github.state.${l.state}`)}
        </Pill>
        <ExternalLink className="size-3.5 shrink-0 text-text-muted" aria-hidden />
      </a>
    </li>
  );
}

/** The GitHub block of a task: linked pull requests and issues, a branch name to copy, an issue button. */
export function GithubCardPanel({ cardId }: { cardId: string }) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const panel = useCardGithub(cardId);
  const create = useCreateIssue(cardId);
  const [copied, setCopied] = useState(false);
  const data = panel.data;
  if (!data || (!data.active && data.links.length === 0)) return null;

  const copy = () =>
    void copyText(data.branch).then((ok) => {
      if (!ok) return toast.error(t('github.copyFailed'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-muted/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text [&_svg]:size-4 [&_svg]:text-text-muted">
        <GitPullRequest aria-hidden />
        {t('github.card.title')}
      </h3>
      {data.links.length > 0 ? (
        <ul className="-mx-2 flex flex-col">
          {data.links.map((l) => (
            <LinkRow key={l.id} l={l} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t('github.card.empty', { repo: data.repo })}</p>
      )}
      {data.active && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={copy}
            aria-label={t('github.card.copyBranch')}
          >
            {copied ? <Check /> : <GitBranch />}
            <span className="max-w-[16rem] truncate font-mono text-xs">{data.branch}</span>
            <Copy className="size-3.5 text-text-muted" />
          </Button>
          {data.canCreateIssue && (
            <Button
              size="sm"
              variant="secondary"
              loading={create.isPending}
              onClick={() =>
                create.mutate(undefined, {
                  onSuccess: () => toast.success(t('github.card.issueCreated')),
                  onError: (e) => toast.error(errorText(e)),
                })
              }
            >
              <Plus />
              {t('github.card.createIssue')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
