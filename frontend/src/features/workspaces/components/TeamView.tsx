import { MailPlus, Search, ShieldCheck, UserPlus, UsersRound, BadgeCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CountUp,
  EmptyState,
  Input,
  Skeleton,
  StatCard,
} from '@/shared/ui';
import { useCurrentWorkspace, useInvites, useMembers } from '../hooks/useWorkspaces';
import { can } from '../model/can';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';
import { InviteDialog } from './InviteDialog';
import { MembersTable } from './MembersTable';
import { PendingInvites } from './PendingInvites';

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[78px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

/** Workspace members, roles and invitations. */
export function TeamView({ currentUserId }: { currentUserId: string }) {
  const { t } = useTranslation('team');
  const errorText = useErrorText();
  const { workspace, isLoading } = useCurrentWorkspace();
  const setCurrent = useCurrentWorkspaceStore((s) => s.setId);
  const canInvite = can(workspace, 'members.invite');
  const members = useMembers(workspace?.id);
  const invites = useInvites(workspace?.id, canInvite);
  const [query, setQuery] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = members.data ?? [];
    return q
      ? list.filter((m) => `${m.user.name} ${m.user.email}`.toLocaleLowerCase().includes(q))
      : list;
  }, [members.data, query]);

  if (isLoading || members.isPending) return <TeamSkeleton />;
  if (!workspace || members.error) {
    return (
      <Card>
        <EmptyState icon={<UsersRound />} title={errorText(members.error)} />
      </Card>
    );
  }

  const admins = (members.data ?? []).filter(
    (m) => m.role === 'owner' || m.role === 'admin',
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<UsersRound />}
          label={t('kpi.members')}
          value={<CountUp value={members.data?.length ?? 0} />}
        />
        <StatCard
          icon={<ShieldCheck />}
          iconTone="purple"
          label={t('kpi.admins')}
          value={<CountUp value={admins} />}
        />
        <StatCard
          icon={<MailPlus />}
          iconTone="amber"
          label={t('kpi.pending')}
          value={canInvite ? <CountUp value={invites.data?.length ?? 0} /> : '—'}
        />
        <StatCard
          icon={<BadgeCheck />}
          iconTone="teal"
          label={t('kpi.yourRole')}
          value={t(`roles.${workspace.role}`)}
        />
      </div>

      <Card className="p-5">
        <CardHeader className="flex-wrap">
          <div>
            <CardTitle>{t('members.title')}</CardTitle>
            <p className="text-sm text-text-muted">
              {t('summary.members', { count: members.data?.length ?? 0 })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              wrapperClassName="w-64"
              leadingIcon={<Search />}
              placeholder={t('members.search')}
              aria-label={t('members.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {canInvite && (
              <Button onClick={() => setInviteOpen(true)}>
                <UserPlus />
                {t('actions.invite')}
              </Button>
            )}
          </div>
        </CardHeader>
        <MembersTable
          workspace={workspace}
          members={filtered}
          currentUserId={currentUserId}
          onLeft={() => setCurrent(null)}
        />
      </Card>

      {canInvite && (
        <Card className="p-5">
          <CardHeader>
            <div>
              <CardTitle>{t('pending.title')}</CardTitle>
              <p className="text-sm text-text-muted">
                {t('summary.pending', { count: invites.data?.length ?? 0 })}
              </p>
            </div>
          </CardHeader>
          {invites.isPending ? (
            <Skeleton className="h-16" />
          ) : (
            <PendingInvites workspace={workspace} invites={invites.data ?? []} />
          )}
        </Card>
      )}

      {canInvite && (
        <InviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspace={workspace}
          actorRole={workspace.role}
        />
      )}
    </div>
  );
}
