import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kanbanApi, type SavedViewInput } from '../api/kanbanApi';

const viewKeys = { all: (ws: string) => ['views', ws] as const };

export function useSavedViews(workspaceId: string | undefined) {
  const qc = useQueryClient();
  const ws = workspaceId ?? '';
  const list = useQuery({
    queryKey: viewKeys.all(ws),
    queryFn: () => kanbanApi.views(ws),
    enabled: !!workspaceId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: viewKeys.all(ws) });
  const create = useMutation({
    mutationFn: (body: SavedViewInput) => kanbanApi.createView(ws, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => kanbanApi.deleteView(id),
    onSuccess: refresh,
  });
  return { list, create, remove };
}
