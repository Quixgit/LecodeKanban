import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { cardKeys, cardsApi, patchCached, type Card, type CardMove } from '@/features/cards';
import { isApiError } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { toast } from '@/shared/ui';
import { drawerKeys } from './useDrawerData';

type CardPatch = Parameters<typeof cardsApi.update>[1];

/**
 * Field edits and moves from the drawer. Every write carries the card's version; if someone
 * else changed the card meanwhile, the latest version is loaded and the user is told.
 */
export function useCardEditor(card: Card | undefined, workspaceId: string) {
  const { t } = useTranslation('card');
  const errorText = useErrorText();
  const qc = useQueryClient();

  const settle = (updated: Card) => {
    patchCached(qc, workspaceId, updated.id, () => updated);
    void qc.invalidateQueries({ queryKey: drawerKeys.activity(updated.id) });
    void qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) });
    void qc.invalidateQueries({ queryKey: ['projects', workspaceId] });
  };
  const onError = (e: unknown) => {
    if (isApiError(e, 'cards.version_conflict') && card) {
      toast.info(t('conflict'));
      void qc.invalidateQueries({ queryKey: cardKeys.one(card.id), exact: true });
      return;
    }
    toast.error(errorText(e));
  };

  const update = useMutation({
    mutationFn: (patch: Omit<CardPatch, 'version'>) =>
      cardsApi.update(card!.id, { ...patch, version: card!.version }),
    onSuccess: settle,
    onError,
  });
  const move = useMutation({
    mutationFn: (to: Omit<CardMove, 'version'>) =>
      cardsApi.move(card!.id, { ...to, version: card!.version }),
    onSuccess: settle,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => cardsApi.remove(card!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
    onError,
  });
  return { update, move, remove };
}
