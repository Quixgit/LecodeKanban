import { copyText } from '@/shared/lib/clipboard';
import { Link2, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkspaceMembers } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Avatar, Button, IconButton, Modal, Pill, Select, Skeleton, toast } from '@/shared/ui';
import type {
  WikiRoleName,
  WikiTarget,
  WikiVisibilityName,
  WikiWorkspaceRole,
} from '../api/wikiApi';
import { useAccess, useWikiMutations } from '../hooks/useWiki';
import { visibilityIcon } from '../model/visibilityIcon';

const ROLES: WikiRoleName[] = ['owner', 'editor', 'commenter', 'viewer'];
const WS_ROLES: WikiWorkspaceRole[] = ['viewer', 'commenter', 'editor'];

type Choice = WikiVisibilityName | 'inherit';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  target: WikiTarget;
  title: string;
}

/** Visibility, people and the effective-access summary of a space, folder or page. */
export function ShareDialog({ open, onOpenChange, workspaceId, target, title }: Props) {
  const { t } = useTranslation('wiki');
  const errorText = useErrorText();
  const access = useAccess(target, open);
  const members = useWorkspaceMembers(workspaceId);
  const m = useWikiMutations(workspaceId);
  const [person, setPerson] = useState('');
  const [role, setRole] = useState<WikiRoleName>('viewer');

  const summary = access.data;
  const canManage = !!summary?.canManage;
  const isSpace = !target.nodeId;
  const nameOf = useMemo(() => {
    const map = new Map((members.data ?? []).map((x) => [x.user.id, x.user]));
    return (id: string) => map.get(id);
  }, [members.data]);

  const direct = (summary?.grants ?? []).filter((g) => !g.inherited);
  const inherited = (summary?.grants ?? []).filter((g) => g.inherited);
  const taken = new Set([summary?.ownerId, ...(summary?.grants ?? []).map((g) => g.principalId)]);
  const candidates = (members.data ?? []).filter((x) => !taken.has(x.user.id));

  const current: Choice = summary?.own ?? 'inherit';
  const choices: Choice[] = isSpace
    ? ['private', 'shared', 'workspace']
    : ['inherit', 'private', 'shared', 'workspace'];

  const run = (p: Promise<unknown>) => p.catch((e: unknown) => toast.error(errorText(e)));

  const setVisibility = (c: Choice) =>
    run(
      m.setVisibility.mutateAsync({
        target,
        visibility: c === 'inherit' ? null : c,
        workspaceRole: summary?.workspaceRole ?? 'viewer',
      }),
    );

  const copyLink = async () => {
    const path = target.nodeId ? `/docs/p/${target.nodeId}` : `/docs/s/${target.spaceId}`;
    try {
      if (!(await copyText(`${window.location.origin}${path}`))) throw new Error('copy failed');
      toast.success(t('share.linkCopied'));
    } catch {
      toast.error(t('share.linkCopyFailed'));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('share.title', { title })}
      description={t('share.description')}
      footer={
        <>
          <Button variant="secondary" onClick={copyLink}>
            <Link2 />
            {t('share.copyLink')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('share.done')}</Button>
        </>
      }
    >
      {access.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-busy>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : access.isError || !summary ? (
        <div className="flex flex-col items-start gap-3 py-2" role="alert">
          <p className="text-base text-text-secondary">{errorText(access.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => access.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section aria-labelledby="share-summary" className="rounded-xl bg-surface-muted p-3.5">
            <h3 id="share-summary" className="sr-only">
              {t('share.summary.title')}
            </h3>
            <p className="text-base text-text">
              {t('share.summary.you', { role: t(`role.${summary.role ?? 'viewer'}`) })}
            </p>
            <p className="mt-0.5 text-sm text-text-muted">
              {summary.inherited
                ? t('share.summary.inherited', {
                    visibility: t(`visibility.${summary.visibility}.name`),
                    source: summary.sourceTitle,
                  })
                : t('share.summary.own', {
                    visibility: t(`visibility.${summary.visibility}.name`),
                  })}
            </p>
          </section>

          <section aria-labelledby="share-visibility">
            <h3 id="share-visibility" className="mb-2 text-sm font-medium text-text">
              {t('share.visibility')}
            </h3>
            <div
              role="radiogroup"
              aria-labelledby="share-visibility"
              className="flex flex-col gap-1.5"
            >
              {choices.map((c) => {
                const Icon = c === 'inherit' ? Link2 : visibilityIcon[c];
                const selected = current === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!canManage || m.setVisibility.isPending}
                    onClick={() => !selected && setVisibility(c)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none disabled:cursor-not-allowed',
                      selected
                        ? 'border-primary-border bg-primary-subtle'
                        : 'border-border bg-surface hover:border-border-strong enabled:hover:bg-surface-muted',
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 size-4 shrink-0 stroke-[1.6]',
                        selected ? 'text-primary-ink' : 'text-text-muted',
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block text-base font-medium text-text">
                        {t(`visibility.${c}.name`)}
                      </span>
                      <span className="block text-sm text-text-muted">
                        {t(`visibility.${c}.description`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {summary.visibility === 'workspace' && !summary.inherited && (
              <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
                <span>{t('share.workspaceCan')}</span>
                <Select
                  label={t('share.workspaceCan')}
                  value={summary.workspaceRole}
                  disabled={!canManage}
                  onValueChange={(v) =>
                    run(
                      m.setVisibility.mutateAsync({
                        target,
                        visibility: current === 'inherit' ? null : current,
                        workspaceRole: v as WikiWorkspaceRole,
                      }),
                    )
                  }
                  options={WS_ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="share-people">
            <h3 id="share-people" className="mb-2 text-sm font-medium text-text">
              {t('share.people')}
            </h3>
            {canManage && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select
                  label={t('share.addPerson')}
                  placeholder={t('share.addPerson')}
                  value={person}
                  onValueChange={setPerson}
                  className="min-w-52"
                  options={candidates.map((c) => ({ value: c.user.id, label: c.user.name }))}
                />
                <Select
                  label={t('share.role')}
                  value={role}
                  onValueChange={(v) => setRole(v as WikiRoleName)}
                  options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
                />
                <Button
                  variant="secondary"
                  disabled={!person}
                  loading={m.setGrant.isPending}
                  onClick={() =>
                    run(m.setGrant.mutateAsync({ target, principalId: person, role })).then(() =>
                      setPerson(''),
                    )
                  }
                >
                  <UserPlus />
                  {t('share.add')}
                </Button>
              </div>
            )}
            <ul className="flex flex-col divide-y divide-border-subtle rounded-xl border border-border-subtle">
              <li className="flex items-center gap-3 px-3.5 py-2.5">
                <PersonCell user={nameOf(summary.ownerId)} fallback={t('share.unknownPerson')} />
                <Pill tone="teal" size="sm">
                  {t('role.owner')}
                </Pill>
              </li>
              {[...inherited, ...direct].map((g) => (
                <li
                  key={`${g.sourceId}-${g.principalId}`}
                  className="flex items-center gap-3 px-3.5 py-2.5"
                >
                  <PersonCell user={nameOf(g.principalId)} fallback={t('share.unknownPerson')} />
                  {g.inherited ? (
                    <>
                      <span className="hidden text-xs text-text-muted sm:block">
                        {t('share.inheritedFrom', { source: g.sourceTitle })}
                      </span>
                      <Pill size="sm">{t(`role.${g.role}`)}</Pill>
                    </>
                  ) : (
                    <>
                      <Select
                        label={t('share.roleOf', { name: nameOf(g.principalId)?.name ?? '' })}
                        value={g.role}
                        disabled={!canManage}
                        onValueChange={(v) =>
                          run(
                            m.setGrant.mutateAsync({
                              target,
                              principalId: g.principalId,
                              role: v as WikiRoleName,
                            }),
                          )
                        }
                        options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
                      />
                      {canManage && (
                        <IconButton
                          label={t('share.remove', { name: nameOf(g.principalId)?.name ?? '' })}
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            run(m.removeGrant.mutateAsync({ target, principalId: g.principalId }))
                          }
                        >
                          <X />
                        </IconButton>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {!canManage && <p className="mt-2 text-xs text-text-muted">{t('share.readOnly')}</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}

function PersonCell({
  user,
  fallback,
}: {
  user?: { name: string; email: string; avatarUrl: string | null };
  fallback: string;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <Avatar name={user?.name ?? fallback} src={user?.avatarUrl} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-base text-text">{user?.name ?? fallback}</span>
        {user && <span className="block truncate text-xs text-text-muted">{user.email}</span>}
      </span>
    </span>
  );
}
