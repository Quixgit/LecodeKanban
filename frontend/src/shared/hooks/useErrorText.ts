import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../api/errors';

/** Translates any thrown error (ApiError codes, network failures) into user-facing text. */
export function useErrorText() {
  const { t } = useTranslation('errors');
  return useCallback(
    (err: unknown): string => {
      if (!isApiError(err)) return t('common.internal');
      const retry = Number(err.meta.retryAfter ?? 0);
      return t(err.code, {
        ...err.meta,
        minutes: Math.max(1, Math.ceil(retry / 60)),
        defaultValue: t('common.internal'),
      });
    },
    [t],
  );
}
