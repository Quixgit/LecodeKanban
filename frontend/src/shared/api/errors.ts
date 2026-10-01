import type { components } from './schema.gen';

export type FieldError = components['schemas']['FieldError'];

/**
 * Error returned by the API. `code` is stable and translated via the `errors`
 * i18n namespace; `message` is an English developer hint only.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: FieldError[];
  readonly meta: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: FieldError[] = [],
    meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.meta = meta;
  }

  /** Field error code for a given input name, if any. */
  field(name: string): FieldError | undefined {
    return this.fields.find((f) => f.field === name);
  }
}

/** Network failure / non-JSON response → a translatable pseudo-code. */
export const NETWORK_ERROR = 'common.network';

export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: components['schemas']['ErrorResponse']['error'] } | undefined)
    ?.error;
  if (err?.code)
    return new ApiError(status, err.code, err.message, err.fields ?? [], err.meta ?? {});
  return new ApiError(status, status >= 500 ? 'common.internal' : NETWORK_ERROR, `HTTP ${status}`);
}

export function isApiError(e: unknown, code?: string): e is ApiError {
  return e instanceof ApiError && (code === undefined || e.code === code);
}
