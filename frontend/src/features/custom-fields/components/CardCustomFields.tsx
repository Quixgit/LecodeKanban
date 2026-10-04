import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Skeleton, toast } from '@/shared/ui';
import { useCardFieldValues, useCustomFields, useSetFieldValue } from '../hooks/useFields';
import { FieldValueInput } from './FieldValueInput';

/** The workspace's custom fields on a card, in the drawer's side panel. Renders nothing without fields. */
export function CardCustomFields({
  cardId,
  workspaceId,
  editable,
}: {
  cardId: string;
  workspaceId: string;
  editable: boolean;
}) {
  const { t } = useTranslation('fields');
  const errorText = useErrorText();
  const fields = useCustomFields(workspaceId);
  const values = useCardFieldValues(cardId);
  const set = useSetFieldValue(cardId, workspaceId);
  if (!fields.data?.length) return null;

  const byField = new Map(values.data?.map((v) => [v.fieldId, v.value]));
  return (
    <section aria-label={t('card.title')} className="flex flex-col gap-5">
      <h3 className="border-t border-border-subtle pt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {t('card.title')}
      </h3>
      {values.isPending ? (
        <Skeleton className="h-16" />
      ) : (
        fields.data.map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {f.name}
            </span>
            <FieldValueInput
              field={f}
              value={byField.get(f.id)}
              disabled={!editable}
              onCommit={(value) =>
                set.mutate({ fieldId: f.id, value }, { onError: (e) => toast.error(errorText(e)) })
              }
            />
            {f.description && <p className="text-xs text-text-muted">{f.description}</p>}
          </div>
        ))
      )}
    </section>
  );
}
