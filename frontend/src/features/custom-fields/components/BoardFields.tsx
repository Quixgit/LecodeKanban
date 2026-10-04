import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CustomField } from '../api/fieldsApi';
import { useBoardFieldValues, useCustomFields } from '../hooks/useFields';
import { FieldChips } from './FieldChips';

interface BoardFieldsValue {
  fields: readonly CustomField[];
  values: ReadonlyMap<string, ReadonlyMap<string, unknown>>;
}

const Ctx = createContext<BoardFieldsValue | null>(null);

/** Loads the custom fields and the values of the cards on screen once, for every card tile. */
export function BoardFieldsProvider({
  workspaceId,
  cardIds,
  children,
}: {
  workspaceId: string;
  cardIds: readonly string[];
  children: ReactNode;
}) {
  const fields = useCustomFields(workspaceId || undefined);
  const onCard = (fields.data ?? []).filter((f) => f.showOnCard);
  const values = useBoardFieldValues(workspaceId || undefined, cardIds, onCard.length > 0);
  const value = useMemo<BoardFieldsValue | null>(
    () => (onCard.length ? { fields: onCard, values: values.data ?? new Map() } : null),
    // `onCard` is rebuilt every render; its content changes only with the query data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields.data, values.data],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The chips of one board card; nothing when no field is marked for the board. */
export function CardFieldChips({ cardId }: { cardId: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return <FieldChips fields={ctx.fields} values={ctx.values.get(cardId)} />;
}
