import { useWorkspaceSettings } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';

/** What this workspace allows in chat (the server enforces it; the screen just does not offer the rest). */
export function useChatRules() {
  const { workspace } = useCurrentWorkspace();
  const s = useWorkspaceSettings(workspace?.id).data;
  return { allowDirect: s?.chatAllowDirect ?? true, allowFiles: s?.chatAllowFiles ?? true };
}
