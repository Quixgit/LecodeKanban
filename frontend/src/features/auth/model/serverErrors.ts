import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/shared/api';
import { fieldMessage } from '@/shared/lib/formMessage';

/**
 * Maps API field errors onto form fields. Returns true when at least one field was
 * marked, so callers can skip the generic alert.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(err) || err.fields.length === 0) return false;
  let applied = false;
  for (const f of err.fields) {
    const name = f.field as Path<T>;
    if (!fields.includes(name)) continue;
    setError(name, {
      type: 'server',
      message: fieldMessage(`validation.${f.code}`, f.params ?? undefined),
    });
    applied = true;
  }
  return applied;
}
