import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
} from '@/shared/ui';
import { useCurrentWorkspace, useWorkspaces } from '../hooks/useWorkspaces';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';

/** Workspace radio list rendered inside the user menu dropdown. */
export function WorkspaceSwitcherItems() {
  const { t } = useTranslation();
  const { data } = useWorkspaces();
  const { workspace } = useCurrentWorkspace();
  const setId = useCurrentWorkspaceStore((s) => s.setId);
  if (!data || data.length === 0) return null;
  return (
    <>
      <DropdownSeparator />
      <DropdownLabel>{t('workspace.label')}</DropdownLabel>
      <DropdownRadioGroup value={workspace?.id} onValueChange={setId}>
        {data.map((w) => (
          <DropdownRadioItem key={w.id} value={w.id}>
            <Building2 />
            <span className="truncate">{w.name}</span>
          </DropdownRadioItem>
        ))}
      </DropdownRadioGroup>
    </>
  );
}
