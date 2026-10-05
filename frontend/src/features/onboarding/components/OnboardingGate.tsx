import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/features/auth';
import { Navigate } from 'react-router-dom';
import { pendingInvite, useWorkspaces } from '@/features/workspaces';
import { useOnboardingStore } from '../store';
import { OnboardingWizard } from './OnboardingWizard';

/**
 * Shows the wizard to someone who has not been through it. A new account owns a workspace that was made for them:
 * the wizard names it and asks who they are. Someone who joined another team's workspace (an invitation) only
 * introduces themselves. The Help page can bring the wizard back.
 */
export function OnboardingGate({ logo }: { logo: ReactNode }) {
  const { user } = useSession();
  const { data: workspaces, isPending } = useWorkspaces(!!user);
  const forced = useOnboardingStore((s) => s.forced);
  const close = useOnboardingStore((s) => s.close);

  // Once the person is marked as onboarded the forced flag has done its job.
  useEffect(() => {
    if (user?.onboarded && !forced) close();
  }, [user?.onboarded, forced, close]);

  if (!user || isPending || !workspaces) return null;
  if (user.onboarded && !forced) return null;
  // Someone who opened an invitation and has not accepted it yet should finish that, not set up a workspace of their own.
  const invite = pendingInvite.get();
  if (invite && !forced) return <Navigate to={`/invite/${invite}`} replace />;
  const joined = workspaces.find((w) => w.role !== 'owner') ?? null;
  const owned = workspaces.find((w) => w.role === 'owner') ?? null;
  return (
    <OnboardingWizard
      mode={joined ? 'join' : 'create'}
      user={user}
      joined={joined}
      owned={owned}
      logo={logo}
      onClose={close}
    />
  );
}
