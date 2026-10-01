import { useSession } from '@/features/auth';
import type { Viewer } from './header/UserMenu';

/** The signed-in user shown in the header (the shell only renders behind RequireAuth). */
export function useViewer(): Viewer {
  const { user } = useSession();
  return { name: user?.name ?? '', email: user?.email, avatarUrl: user?.avatarUrl };
}
