import { useMemo } from 'react';
import { useWorkspaceSettings } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';
import { navigation, type NavSection } from './navigation';

const FEATURE_OF = {
  calendar: 'calendar',
  chat: 'chat',
  docs: 'docs',
  integrations: 'integrations',
} as const;

/** The sidebar structure without the parts an administrator switched off for this workspace. */
export function useNavigation(): NavSection[] {
  const { workspace } = useCurrentWorkspace();
  const { data } = useWorkspaceSettings(workspace?.id);
  return useMemo(() => {
    if (!data) return navigation;
    return navigation.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const feature = FEATURE_OF[item.key as keyof typeof FEATURE_OF];
        return !feature || data.features[feature];
      }),
    }));
  }, [data]);
}
