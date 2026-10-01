/**
 * Zod/react-hook-form messages are stored as i18n descriptors so validation
 * text follows the active language: `fieldMessage('validation.min_length', { min: 10 })`.
 */
export interface FieldMessage {
  key: string;
  params?: Record<string, unknown>;
}

export function fieldMessage(key: string, params?: Record<string, unknown>): string {
  return JSON.stringify({ key, params } satisfies FieldMessage);
}

export function parseFieldMessage(message: string | undefined): FieldMessage | null {
  if (!message) return null;
  try {
    const parsed = JSON.parse(message) as FieldMessage;
    return typeof parsed.key === 'string' ? parsed : null;
  } catch {
    return { key: message };
  }
}
