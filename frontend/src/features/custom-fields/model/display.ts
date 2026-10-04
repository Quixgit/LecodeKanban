import type { CustomField, FieldOption } from '../api/fieldsApi';

/** The choice a select value points at, if it still exists. */
export function optionOf(field: CustomField, value: unknown): FieldOption | undefined {
  return typeof value === 'string' ? field.options.find((o) => o.id === value) : undefined;
}

/** A short text for a value on a board chip or tooltip; empty when there is nothing to show. */
export function displayValue(field: CustomField, value: unknown, locale: string): string {
  if (value === null || value === undefined || value === '') return '';
  switch (field.kind) {
    case 'select':
      return optionOf(field, value)?.label ?? '';
    case 'number':
      return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : '';
    case 'date':
      return typeof value === 'string'
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
            new Date(`${value}T00:00:00Z`),
          )
        : '';
    case 'checkbox':
      return value === true ? '✓' : '';
    case 'url':
      try {
        return new URL(String(value)).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    default:
      return String(value);
  }
}

/** Fields to show as chips on a board card: marked for it and holding a value, in field order. */
export function chipsFor(
  fields: readonly CustomField[],
  values: ReadonlyMap<string, unknown> | undefined,
  locale: string,
): { field: CustomField; text: string; tone: string }[] {
  if (!values) return [];
  const out: { field: CustomField; text: string; tone: string }[] = [];
  for (const field of fields) {
    if (!field.showOnCard) continue;
    const value = values.get(field.id);
    const text = displayValue(field, value, locale);
    if (text) out.push({ field, text, tone: optionOf(field, value)?.tone ?? 'neutral' });
  }
  return out;
}
