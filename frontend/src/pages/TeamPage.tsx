import { useSession } from '@/features/auth';
import { TeamView } from '@/features/workspaces';

export default function TeamPage() {
  const { user } = useSession();
  return user ? <TeamView currentUserId={user.id} /> : null;
}
