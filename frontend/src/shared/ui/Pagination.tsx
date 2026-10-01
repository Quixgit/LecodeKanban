import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { pageWindow } from '../lib/pageWindow';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onShowAll?: () => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onShowAll,
  className,
}: PaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn('flex flex-wrap items-center justify-between gap-3', className)}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          {t('pagination.previous')}
        </Button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="w-9 text-center text-text-muted" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'tabular size-9 rounded-md text-base transition-colors duration-micro',
                p === page
                  ? 'border border-border bg-surface font-medium text-text shadow-xs'
                  : 'text-text-secondary hover:bg-surface-sunken',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {t('pagination.next')}
          <ChevronRight />
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm text-text-muted">{t('pagination.showing', { from, to, total })}</p>
        {onShowAll && (
          <Button variant="secondary" size="sm" onClick={onShowAll}>
            {t('pagination.showAll')}
          </Button>
        )}
      </div>
    </nav>
  );
}
