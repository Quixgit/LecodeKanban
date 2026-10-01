import { Skeleton } from '@/shared/ui';

/** Route-level loading placeholder: KPI row + panel with table rows. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-border-subtle bg-surface p-4"
          >
            <Skeleton className="size-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border-subtle bg-surface p-5">
        <Skeleton className="mb-5 h-9 w-1/3" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
