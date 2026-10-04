import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { toast } from '@/shared/ui';
import type { WorkspaceSettingsPatch } from '../api/settingsApi';
import { useUpdateSettings } from '../hooks/useSettings';

/** Saves one change at once and says so; an error is shown and the screen rolls back. */
export function useSaver(workspaceId: string) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const update = useUpdateSettings(workspaceId);
  return {
    saving: update.isPending,
    save: (patch: WorkspaceSettingsPatch, onDone?: () => void) =>
      update.mutate(patch, {
        onSuccess: () => {
          toast.success(t('saved'));
          onDone?.();
        },
        onError: (e) => toast.error(errorText(e)),
      }),
  };
}
