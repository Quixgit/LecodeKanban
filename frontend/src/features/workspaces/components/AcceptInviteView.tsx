import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailCheck, MailX, PartyPopper } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, EmptyState, FormAlert, Skeleton, toast } from '@/shared/ui';
import { workspacesApi } from '../api/workspacesApi';
import { workspaceKeys } from '../hooks/useWorkspaces';
import { pendingInvite } from '../model/pendingInvite';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';

interface Props {
  token: string;
  user: User | null;
  /** Signs out and comes back to this page (switch account). */
  onSwitchAccount: () => void;
}

/** Public invitation screen: preview → sign in/up → join. */
export function AcceptInviteView({ token, user, onSwitchAccount }: Props) {
  const { t } = useTranslation(['auth', 'team']);
  const errorText = useErrorText();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setCurrent = useCurrentWorkspaceStore((s) => s.setId);
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => workspacesApi.previewInvite(token),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () => workspacesApi.acceptInvite(token),
    onSuccess: async (ws) => {
      pendingInvite.clear();
      setCurrent(ws.id);
      // Wait for the fresh list (not just mark it stale): the welcome guide reads it on arrival, and an old list
      // would still say this person owns only their own workspace and offer to create one.
      await qc.refetchQueries({ queryKey: workspaceKeys.all, type: 'all' });
      toast.success(t('auth:invite.joined', { workspace: ws.name }));
      navigate('/team', { replace: true });
    },
  });

  // Remember an open invitation until it is accepted; forget it once it is unusable or belongs to someone else.
  const data = preview.data;
  const usable = !!data && !data.accepted && !data.expired;
  const wrongAccount = !!user && !!data && user.email.toLowerCase() !== data.email.toLowerCase();
  const failed = !!preview.error;
  const joined = accept.isSuccess;
  useEffect(() => {
    // Once joined the invitation is spent: remembering it again would send the person back to it.
    if (joined) return;
    if (usable && !wrongAccount) pendingInvite.set(token);
    else if (failed || (data && !usable) || wrongAccount) pendingInvite.clear();
  }, [joined, usable, wrongAccount, failed, data, token]);

  if (preview.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-14" aria-busy>
        <Skeleton className="size-14 rounded-2xl" />
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }
  const home = (
    <Button asChild variant="secondary">
      <Link to="/">{t('auth:invite.goHome')}</Link>
    </Button>
  );
  if (preview.error)
    return (
      <EmptyState
        className="px-0"
        icon={<MailX />}
        title={t('auth:invite.title')}
        description={errorText(preview.error)}
        action={home}
      />
    );

  const p = preview.data;
  if (p.accepted)
    return (
      <EmptyState
        className="px-0"
        icon={<MailX />}
        title={t('auth:invite.title')}
        description={t('auth:invite.used')}
        action={home}
      />
    );
  if (p.expired)
    return (
      <EmptyState
        className="px-0"
        icon={<MailX />}
        title={t('auth:invite.title')}
        description={t('auth:invite.expired')}
        action={home}
      />
    );

  const role = t(`team:roles.${p.role}`);
  const body = p.inviterName
    ? t('auth:invite.body', { inviter: p.inviterName, workspace: p.workspaceName, role })
    : t('auth:invite.bodyNoInviter', { workspace: p.workspaceName, role });
  const next = encodeURIComponent(`/invite/${token}`);
  const email = encodeURIComponent(p.email);
  const mismatch = user && user.email.toLowerCase() !== p.email.toLowerCase();

  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink">
        <PartyPopper className="size-7 stroke-[1.6]" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text">{t('auth:invite.title')}</h1>
      <p className="mt-2 max-w-sm text-base text-text-secondary">{body}</p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs text-text-muted">
        <MailCheck className="size-3.5" aria-hidden />
        {t('auth:invite.sentTo', { email: p.email })}
      </p>

      <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
        <FormAlert>{accept.error ? errorText(accept.error) : null}</FormAlert>
        {!user && p.hasAccount && (
          <>
            <p className="text-xs text-text-muted">{t('auth:invite.hasAccountHint')}</p>
            <Button asChild size="lg" block>
              <Link to={`/login?next=${next}&email=${email}`}>
                {t('auth:invite.signInToAccept')}
              </Link>
            </Button>
            <Link
              to={`/forgot-password?email=${email}`}
              className="text-sm font-medium text-primary-ink hover:underline"
            >
              {t('auth:invite.forgot')}
            </Link>
          </>
        )}
        {!user && !p.hasAccount && (
          <>
            <Button asChild size="lg" block>
              <Link to={`/register?next=${next}&email=${email}`}>
                {t('auth:invite.registerToAccept')}
              </Link>
            </Button>
            <p className="text-xs text-text-muted">{t('auth:invite.newHint')}</p>
          </>
        )}
        {user && mismatch && (
          <>
            <FormAlert>
              {t('auth:invite.wrongAccount', { current: user.email, email: p.email })}
            </FormAlert>
            <Button size="lg" variant="secondary" block onClick={onSwitchAccount}>
              {t('auth:invite.switchAccount')}
            </Button>
          </>
        )}
        {user && !mismatch && (
          <Button size="lg" block loading={accept.isPending} onClick={() => accept.mutate()}>
            {t('auth:invite.accept')}
          </Button>
        )}
      </div>
    </div>
  );
}
