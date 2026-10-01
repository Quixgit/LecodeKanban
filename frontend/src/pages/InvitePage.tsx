import { useParams } from 'react-router-dom';
import { useLogout, useSession } from '@/features/auth';
import { AcceptInviteView } from '@/features/workspaces';

export default function InvitePage() {
  const { token = '' } = useParams();
  const { user } = useSession();
  const logout = useLogout();
  return <AcceptInviteView token={token} user={user} onSwitchAccount={() => logout.mutate()} />;
}
