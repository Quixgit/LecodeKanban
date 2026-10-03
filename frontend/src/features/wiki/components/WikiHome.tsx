import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { Button } from '@/shared/ui';
import { useWikiUiStore } from '../store/wikiUiStore';
import { useSession } from '@/features/auth';
import { NoSpaces, type WikiOutletContext } from './WikiLayout';
import { SpaceDialog } from './SpaceDialog';

/** /docs: jumps to the last opened (or first) space, or invites to create the first one. */
export function WikiHome() {
  const { t } = useTranslation('wiki');
  const navigate = useNavigate();
  const { user } = useSession();
  const { workspaceId, spaces } = useOutletContext<WikiOutletContext>();
  const last = useWikiUiStore((s) => s.lastSpace[user?.id ?? 'anonymous']);
  const [creating, setCreating] = useState(false);
  const target = spaces.find((s) => s.id === last) ?? spaces[0];
  if (target) return <Navigate to={`/docs/s/${target.id}`} replace />;
  return (
    <>
      <NoSpaces
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t('spaces.create')}
          </Button>
        }
      />
      <SpaceDialog
        open={creating}
        onOpenChange={setCreating}
        workspaceId={workspaceId}
        onSaved={(s) => navigate(`/docs/s/${s.id}`)}
      />
    </>
  );
}
