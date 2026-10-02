import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { isChunkLoadError, reloadOnce } from '@/shared/lib/reload';
import { Button, Card, EmptyState } from '@/shared/ui';

/** Route-level error boundary: a failing page shows this instead of leaving a blank, dead app. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const stale = isChunkLoadError(error);

  useEffect(() => {
    if (stale)
      reloadOnce(); // new deployment: fetch the fresh bundle
    else console.error('[route error]', error);
  }, [error, stale]);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return (
    <Card className="min-h-[50vh] content-center" role="alert">
      <EmptyState
        icon={<TriangleAlert />}
        title={t(stale ? 'routeError.updated' : 'routeError.title')}
        description={stale ? t('routeError.updatedHint') : t('routeError.description')}
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>{t('routeError.reload')}</Button>
              <Button variant="secondary" asChild>
                <a href="/">{t('routeError.home')}</a>
              </Button>
            </div>
            {detail && !stale && (
              <code className="max-w-md break-words text-xs text-text-muted">{detail}</code>
            )}
          </div>
        }
      />
    </Card>
  );
}
