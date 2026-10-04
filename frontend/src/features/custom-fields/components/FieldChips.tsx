import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { Pill, Tooltip, type Tone } from '@/shared/ui';
import type { CustomField } from '../api/fieldsApi';
import { chipsFor } from '../model/display';

/** Custom field values a field is marked to show on the board, as small chips on a card. */
export function FieldChips({
  fields,
  values,
}: {
  fields: readonly CustomField[];
  values: ReadonlyMap<string, unknown> | undefined;
}) {
  const { t } = useTranslation('fields');
  const { language } = useLanguage();
  const chips = chipsFor(fields, values, language);
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label={t('card.title')}>
      {chips.slice(0, 3).map(({ field, text, tone }) => (
        <li key={field.id}>
          <Tooltip content={`${field.name}: ${text}`}>
            <span>
              <Pill tone={tone as Tone} size="sm" className="h-5 max-w-36 px-2 text-2xs">
                {field.kind === 'checkbox' ? (
                  <>
                    <Check className="size-3" aria-hidden />
                    <span className="truncate">{field.name}</span>
                  </>
                ) : (
                  <span className="truncate">
                    <span className="opacity-70">{field.name} · </span>
                    {text}
                  </span>
                )}
              </Pill>
            </span>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
