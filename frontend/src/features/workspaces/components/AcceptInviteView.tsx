import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailCheck, MailX, PartyPopper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, EmptyState, FormAlert, Skeleton, toast } from '@/shared/ui';
import { workspacesApi } from '../api/workspacesApi';
import { workspaceKeys } from '../hooks/useWorkspaces';
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
      setCurrent(ws.id);
      await qc.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success(t('auth:invite.joined', { workspace: ws.name }));
      navigate('/team', { replace: true });
    },
  });

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
        {!user && (
          <>
            <Button asChild size="lg" block>
              <Link to={`/login?next=${next}`}>{t('auth:invite.signInToAccept')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" block>
              <Link to={`/register?next=${next}`}>{t('auth:invite.registerToAccept')}</Link>
            </Button>
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
