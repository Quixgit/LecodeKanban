import { useOutletContext } from 'react-router-dom';
import { TrashView } from './TrashView';
import type { WikiOutletContext } from './WikiLayout';

export function TrashRoute() {
  const { workspaceId } = useOutletContext<WikiOutletContext>();
  return <TrashView workspaceId={workspaceId} />;
}
