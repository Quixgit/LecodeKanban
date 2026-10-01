import { useSession } from '@/features/auth';
import { TasksListView } from '@/features/tasks-list';

export default function TasksPage() {
  const { user } = useSession();
  return user ? <TasksListView currentUserId={user.id} /> : null;
}
